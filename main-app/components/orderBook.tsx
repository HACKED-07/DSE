"use client";

import { cn } from "@/lib/utils";
import { ChevronDown, ChevronRight, Ellipsis } from "lucide-react";
import { memo, startTransition, useEffect, useMemo, useRef, useState } from "react";
import { io, type Socket } from "socket.io-client";

type RawOrder = {
  orderId: string;
  price: number;
  originalQty: number;
  remainingQty: number;
  timestamp: number;
};

type OrderBookSnapshot = {
  buys: RawOrder[];
  sells: RawOrder[];
};

type OrderBookChange = ["buy" | "sell", number, number];

type OrderLevel = {
  key: string;
  price: number;
  amount: number;
  total: number;
  depthRatio: number;
};

type LevelState = {
  buys: Map<number, number>;
  sells: Map<number, number>;
};

const RESYNC_INTERVAL_MS = 6000;
const VISIBLE_LEVELS = 14;

const priceFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const amountFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 0,
  maximumFractionDigits: 5,
});

const preciseAmountFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 8,
});

const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  minimumFractionDigits: 0,
  maximumFractionDigits: 2,
});

const preciseTotalFormat = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 6,
});

function normalizeSnapshot(snapshot: Partial<OrderBookSnapshot>): OrderBookSnapshot {
  return {
    buys: Array.isArray(snapshot.buys)
      ? snapshot.buys.filter((order) => Number(order.remainingQty) > 0)
      : [],
    sells: Array.isArray(snapshot.sells)
      ? snapshot.sells.filter((order) => Number(order.remainingQty) > 0)
      : [],
  };
}

function toLevelState(snapshot: OrderBookSnapshot): LevelState {
  const levels: LevelState = {
    buys: new Map(),
    sells: new Map(),
  };

  for (const order of snapshot.buys) {
    levels.buys.set(
      order.price,
      (levels.buys.get(order.price) ?? 0) + Number(order.remainingQty),
    );
  }

  for (const order of snapshot.sells) {
    levels.sells.set(
      order.price,
      (levels.sells.get(order.price) ?? 0) + Number(order.remainingQty),
    );
  }

  return levels;
}

function cloneLevels(levels: LevelState): LevelState {
  return {
    buys: new Map(levels.buys),
    sells: new Map(levels.sells),
  };
}

function applyChanges(levels: LevelState, changes: OrderBookChange[]) {
  const next = cloneLevels(levels);

  for (const [side, price, qty] of changes) {
    const bookSide = side === "buy" ? next.buys : next.sells;
    if (qty <= 0.00000001) {
      bookSide.delete(price);
    } else {
      bookSide.set(price, qty);
    }
  }

  return next;
}

function aggregateLevels(
  levelsMap: Map<number, number>,
  side: "buys" | "sells",
): {
  levels: OrderLevel[];
  bestPrice: number | null;
  totalLiquidity: number;
} {
  const sorted = Array.from(levelsMap.entries())
    .filter(([, amount]) => amount > 0.00000001)
    .map(([price, amount]) => ({
      key: `${side}-${price}`,
      price,
      amount,
      total: price * amount,
    }))
    .sort((a, b) => (side === "buys" ? b.price - a.price : a.price - b.price));

  const visible = sorted.slice(0, VISIBLE_LEVELS);
  const maxTotal = Math.max(...visible.map((level) => level.total), 1);
  const normalized = visible.map((level) => ({
    ...level,
    depthRatio: level.total / maxTotal,
  }));

  return {
    levels: side === "sells" ? [...normalized].reverse() : normalized,
    bestPrice: visible[0]?.price ?? null,
    totalLiquidity: visible.reduce((sum, level) => sum + level.total, 0),
  };
}

function getBestPrice(levelsMap: Map<number, number>, side: "buys" | "sells") {
  const prices = Array.from(levelsMap.entries())
    .filter(([, qty]) => qty > 0)
    .map(([price]) => price);

  if (prices.length === 0) return null;
  return side === "buys" ? Math.max(...prices) : Math.min(...prices);
}

function getMidPrice(levels: LevelState) {
  const bestBid = getBestPrice(levels.buys, "buys");
  const bestAsk = getBestPrice(levels.sells, "sells");

  if (bestBid !== null && bestAsk !== null) {
    return (bestBid + bestAsk) / 2;
  }

  return bestBid ?? bestAsk ?? 0;
}

function splitSymbol(symbol: string) {
  const [baseAsset = "BTC", quoteAsset = "USDT"] = symbol.split("_");
  return { baseAsset, quoteAsset };
}

function formatTotal(total: number) {
  if (total === 0) return "0.00";
  if (Math.abs(total) < 1) {
    return preciseTotalFormat.format(total);
  }

  return compactFormat.format(total);
}

function formatAmount(amount: number) {
  if (amount === 0) return "0.00";
  if (Math.abs(amount) < 1) {
    return preciseAmountFormat.format(amount);
  }

  return amountFormat.format(amount);
}

const OrderBookRow = memo(function OrderBookRow({
  level,
  side,
  baseAsset,
  quoteAsset,
}: {
  level: OrderLevel;
  side: "buys" | "sells";
  baseAsset: string;
  quoteAsset: string;
}) {
  return (
    <div
      className="relative grid grid-cols-[1.2fr_0.95fr_1.1fr] items-center gap-3 overflow-hidden px-4 py-0.5 text-[0.84rem] leading-6 tabular-nums"
      style={{ contain: "layout paint style" }}
    >
      <div
        className={cn(
          "absolute inset-y-[3px] right-0 rounded-l-sm",
          side === "buys" ? "bg-emerald-400/11" : "bg-rose-400/12",
        )}
        style={{
          width: `${Math.max(level.depthRatio * 100, 2)}%`,
          willChange: "width",
        }}
      />
      <div
        className={cn(
          "relative z-10 font-medium",
          side === "buys" ? "text-emerald-500" : "text-rose-500",
        )}
        aria-label={`Price in ${quoteAsset}`}
      >
        {priceFormat.format(level.price)}
      </div>
      <div
        className="relative z-10 text-right text-zinc-900"
        aria-label={`Amount in ${baseAsset}`}
      >
        {formatAmount(level.amount)}
      </div>
      <div
        className="relative z-10 text-right text-zinc-900"
        aria-label={`Total in ${quoteAsset}`}
      >
        {formatTotal(level.total)}
      </div>
    </div>
  );
});

export function OrderBook({
  initialData,
  symbol,
}: {
  initialData: OrderBookSnapshot;
  symbol: string;
}) {
  const [levels, setLevels] = useState<LevelState>(() =>
    toLevelState(normalizeSnapshot(initialData)),
  );
  const [isLive, setIsLive] = useState(true);
  const [priceDirection, setPriceDirection] = useState<"up" | "down" | "flat">(
    "flat",
  );

  const pendingLevelsRef = useRef<LevelState | null>(null);
  const latestLevelsRef = useRef<LevelState>(toLevelState(normalizeSnapshot(initialData)));
  const frameRef = useRef<number | null>(null);
  const resyncTimerRef = useRef<number | null>(null);
  const socketRef = useRef<Socket | null>(null);
  const lastMidPriceRef = useRef<number | null>(null);

  const { baseAsset, quoteAsset } = splitSymbol(symbol);

  useEffect(() => {
    latestLevelsRef.current = levels;
  }, [levels]);

  useEffect(() => {
    let cancelled = false;

    const flushLevels = () => {
      frameRef.current = null;
      const nextLevels = pendingLevelsRef.current;
      pendingLevelsRef.current = null;

      if (!nextLevels) return;

      const nextMidPrice = getMidPrice(nextLevels);
      const previousMidPrice = lastMidPriceRef.current;
      if (previousMidPrice === null) {
        setPriceDirection("flat");
      } else if (nextMidPrice > previousMidPrice) {
        setPriceDirection("up");
      } else if (nextMidPrice < previousMidPrice) {
        setPriceDirection("down");
      } else {
        setPriceDirection("flat");
      }

      lastMidPriceRef.current = nextMidPrice;
      latestLevelsRef.current = nextLevels;
      startTransition(() => {
        setLevels(nextLevels);
      });
    };

    const queueLevels = (nextLevels: LevelState) => {
      pendingLevelsRef.current = nextLevels;
      if (frameRef.current !== null) return;
      frameRef.current = window.requestAnimationFrame(flushLevels);
    };

    const loadSnapshot = async () => {
      try {
        const response = await fetch(`http://localhost:3002/markets/${symbol}`, {
          cache: "no-store",
        });

        if (!response.ok) {
          setIsLive(false);
          return;
        }

        const nextLevels = toLevelState(normalizeSnapshot(await response.json()));
        setIsLive(true);
        queueLevels(nextLevels);
      } catch {
        setIsLive(false);
      }
    };

    const scheduleResync = () => {
      if (cancelled) return;
      resyncTimerRef.current = window.setTimeout(async () => {
        await loadSnapshot();
        scheduleResync();
      }, RESYNC_INTERVAL_MS);
    };

    const socket = io("http://localhost:3002", {
      transports: ["websocket"],
    });
    socketRef.current = socket;

    socket.on("connect", async () => {
      setIsLive(true);
      socket.emit("subscribe", symbol.replace("_", "/"));
      await loadSnapshot();
    });

    socket.on("update", (payload: { changes?: OrderBookChange[] }) => {
      const changes = Array.isArray(payload?.changes) ? payload.changes : [];
      if (changes.length === 0) return;

      const nextLevels = applyChanges(latestLevelsRef.current, changes);
      setIsLive(true);
      queueLevels(nextLevels);
    });

    socket.on("disconnect", () => {
      setIsLive(false);
    });

    socket.on("connect_error", () => {
      setIsLive(false);
    });

    loadSnapshot();
    scheduleResync();

    return () => {
      cancelled = true;

      if (resyncTimerRef.current !== null) {
        window.clearTimeout(resyncTimerRef.current);
      }

      if (frameRef.current !== null) {
        window.cancelAnimationFrame(frameRef.current);
      }

      socket.disconnect();
      socketRef.current = null;
    };
  }, [symbol]);

  const { buys, sells, bestBid, bestAsk, midPrice, bidPressure } = useMemo(() => {
    const buyLevels = aggregateLevels(levels.buys, "buys");
    const sellLevels = aggregateLevels(levels.sells, "sells");
    const nextMidPrice =
      buyLevels.bestPrice !== null && sellLevels.bestPrice !== null
        ? (buyLevels.bestPrice + sellLevels.bestPrice) / 2
        : buyLevels.bestPrice ?? sellLevels.bestPrice ?? 0;
    const totalLiquidity =
      buyLevels.totalLiquidity + sellLevels.totalLiquidity || 1;

    return {
      buys: buyLevels.levels,
      sells: sellLevels.levels,
      bestBid: buyLevels.bestPrice,
      bestAsk: sellLevels.bestPrice,
      midPrice: nextMidPrice,
      bidPressure: (buyLevels.totalLiquidity / totalLiquidity) * 100,
    };
  }, [levels]);

  return (
    <section className="flex h-full min-h-[720px] flex-col overflow-hidden rounded-[1.7rem] border border-zinc-200 bg-white shadow-[0_24px_60px_-48px_rgba(15,23,42,0.24)]">
      <div className="flex items-center justify-between border-b border-zinc-200 px-5 py-4">
        <div>
          <h2 className="text-[1.15rem] font-semibold tracking-[-0.03em] text-zinc-950">
            Order Book
          </h2>
          <div className="mt-1 flex items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-zinc-400">
            <span
              className={cn(
                "inline-flex h-2 w-2 rounded-full",
                isLive ? "bg-emerald-500" : "bg-amber-500",
              )}
            />
            {isLive ? "Live" : "Reconnecting"}
          </div>
        </div>
        <button
          type="button"
          className="rounded-full p-2 text-zinc-400 transition hover:bg-zinc-100 hover:text-zinc-600"
          aria-label="Order book options"
        >
          <Ellipsis className="h-4 w-4" />
        </button>
      </div>

      <div className="flex items-center justify-between px-5 py-3 text-xs text-zinc-400">
        <div className="flex items-center gap-3">
          <div className="grid grid-cols-2 gap-0.5 rounded-md bg-zinc-100 p-1">
            <span className="h-3.5 w-1.5 rounded-[2px] bg-rose-500/90" />
            <span className="h-3.5 w-1.5 rounded-[2px] bg-zinc-300" />
            <span className="h-3.5 w-1.5 rounded-[2px] bg-emerald-500/90" />
            <span className="h-3.5 w-1.5 rounded-[2px] bg-zinc-300" />
          </div>
          <div className="grid grid-cols-3 gap-0.5 rounded-md bg-zinc-100 p-1">
            <span className="h-4 w-1.5 rounded-[2px] bg-emerald-400/55" />
            <span className="h-4 w-1.5 rounded-[2px] bg-zinc-300" />
            <span className="h-4 w-1.5 rounded-[2px] bg-zinc-300" />
          </div>
          <div className="grid grid-cols-3 gap-0.5 rounded-md bg-zinc-100 p-1">
            <span className="h-4 w-1.5 rounded-[2px] bg-rose-400/55" />
            <span className="h-4 w-1.5 rounded-[2px] bg-zinc-300" />
            <span className="h-4 w-1.5 rounded-[2px] bg-zinc-300" />
          </div>
        </div>
        <button
          type="button"
          className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-medium text-zinc-500 transition hover:bg-zinc-100 hover:text-zinc-700"
        >
          0.01
          <ChevronDown className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="grid grid-cols-[1.2fr_0.95fr_1.1fr] gap-3 px-5 pb-2 text-[0.82rem] text-zinc-400">
        <div>Price ({quoteAsset})</div>
        <div className="text-right">Amount ({baseAsset})</div>
        <div className="text-right">Total</div>
      </div>

      <div className="flex-1 overflow-hidden px-2 pb-2">
        <div className="h-full overflow-y-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <div className="pb-3">
            {sells.map((level) => (
              <OrderBookRow
                key={level.key}
                level={level}
                side="sells"
                baseAsset={baseAsset}
                quoteAsset={quoteAsset}
              />
            ))}
          </div>

          <div className="mx-4 my-2 flex items-center justify-between rounded-2xl border border-zinc-200/80 bg-zinc-50 px-4 py-2.5">
            <div className="flex items-baseline gap-2">
              <span
                className={cn(
                  "text-[1.55rem] font-semibold tracking-[-0.05em]",
                  priceDirection === "down"
                    ? "text-rose-500"
                    : "text-emerald-500",
                )}
              >
                {priceFormat.format(midPrice)}
                {priceDirection === "up" ? "↑" : priceDirection === "down" ? "↓" : ""}
              </span>
              <span className="text-sm text-zinc-400">{quoteAsset}</span>
            </div>
            <ChevronRight className="h-4 w-4 text-zinc-400" />
          </div>

          <div className="pt-1">
            {buys.map((level) => (
              <OrderBookRow
                key={level.key}
                level={level}
                side="buys"
                baseAsset={baseAsset}
                quoteAsset={quoteAsset}
              />
            ))}
          </div>
        </div>
      </div>

      <div className="border-t border-zinc-200 px-5 py-4">
        <div className="flex items-center justify-between text-[0.9rem] tabular-nums">
          <span className="text-emerald-500">B {bidPressure.toFixed(1)}%</span>
          <span className="text-rose-500">S {(100 - bidPressure).toFixed(1)}%</span>
        </div>
        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-zinc-100">
          <div className="flex h-full">
            <div
              className="h-full rounded-full bg-emerald-500"
              style={{ width: `${Math.max(bidPressure, 4)}%` }}
            />
            <div
              className="h-full rounded-full bg-rose-500"
              style={{ width: `${Math.max(100 - bidPressure, 4)}%` }}
            />
          </div>
        </div>
        <div className="mt-3 flex items-center justify-between text-[11px] tabular-nums text-zinc-400">
          <span>Bid {bestBid ? priceFormat.format(bestBid) : "--"}</span>
          <span>Ask {bestAsk ? priceFormat.format(bestAsk) : "--"}</span>
        </div>
      </div>
    </section>
  );
}
