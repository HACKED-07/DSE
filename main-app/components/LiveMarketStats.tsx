"use client";

import { ArrowUpRight, CandlestickChart, Layers3 } from "lucide-react";
import { useEffect, useState } from "react";
import { io } from "socket.io-client";
import type { MarketStats } from "@/lib/market-data";

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL ?? "http://localhost:3002";
const REFRESH_INTERVAL_MS = 3500;

const priceFormat = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const compactFormat = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 2,
});

type RawOrder = {
  price: number;
  remainingQty: number;
};

type SnapshotResponse = {
  bestBid: RawOrder | null;
  bestAsk: RawOrder | null;
  midPrice: number | null;
  spread: number | null;
  depth: {
    buys: RawOrder[];
    sells: RawOrder[];
  };
};

type OhlcResponse = {
  candles?: {
    open: number;
    close: number;
  }[];
};

function computeLiquidity(snapshot: SnapshotResponse) {
  const allOrders = [...snapshot.depth.buys, ...snapshot.depth.sells];
  return allOrders.reduce(
    (total, order) => total + order.price * Math.max(order.remainingQty, 0),
    0,
  );
}

function computeChangePercent(candles: { open: number; close: number }[]) {
  if (candles.length === 0 || candles[0]?.open === 0) {
    return null;
  }

  const first = candles[0];
  const last = candles[candles.length - 1];
  if (!first || !last) {
    return null;
  }

  return ((last.close - first.open) / first.open) * 100;
}

export function LiveMarketStats({
  symbol,
  initialStats,
}: {
  symbol: string;
  initialStats: MarketStats;
}) {
  const [stats, setStats] = useState(initialStats);

  useEffect(() => {
    let cancelled = false;
    let timeoutId: number | null = null;

    const refresh = async () => {
      try {
        const [snapshotResponse, ohlcResponse] = await Promise.all([
          fetch(`${ENGINE_URL}/snapshot/${symbol}`, { cache: "no-store" }),
          fetch(`${ENGINE_URL}/ohlc/${symbol}`, { cache: "no-store" }),
        ]);

        if (!snapshotResponse.ok || !ohlcResponse.ok || cancelled) {
          return;
        }

        const snapshot = (await snapshotResponse.json()) as SnapshotResponse;
        const ohlc = (await ohlcResponse.json()) as OhlcResponse;
        const candles = Array.isArray(ohlc.candles) ? ohlc.candles : [];

        setStats({
          symbol: initialStats.symbol,
          lastPrice:
            candles[candles.length - 1]?.close ??
            snapshot.midPrice ??
            snapshot.bestBid?.price ??
            snapshot.bestAsk?.price ??
            null,
          changePercent: computeChangePercent(candles),
          visibleLiquidity: computeLiquidity(snapshot),
          spread: snapshot.spread,
        });
      } catch {
        return;
      }
    };

    const socket = io(ENGINE_URL, {
      transports: ["websocket"],
    });

    socket.on("connect", () => {
      socket.emit("subscribe", symbol.replace("_", "/"));
    });

    socket.on("update", () => {
      void refresh();
    });

    timeoutId = window.setInterval(() => {
      void refresh();
    }, REFRESH_INTERVAL_MS);

    void refresh();

    return () => {
      cancelled = true;
      if (timeoutId !== null) {
        window.clearInterval(timeoutId);
      }
      socket.disconnect();
    };
  }, [initialStats.symbol, symbol]);

  return (
    <div className="grid gap-3 sm:grid-cols-3">
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
          <CandlestickChart className="size-4" />
          Price
        </div>
        <div className="mt-2 text-2xl font-black">
          {stats.lastPrice === null ? "Unavailable" : priceFormat.format(stats.lastPrice)}
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
          <ArrowUpRight className="size-4" />
          Change
        </div>
        <div
          className={`mt-2 text-2xl font-black ${
            (stats.changePercent ?? 0) >= 0 ? "text-emerald-600" : "text-rose-600"
          }`}
        >
          {stats.changePercent === null
            ? "Flat"
            : `${stats.changePercent >= 0 ? "+" : ""}${stats.changePercent.toFixed(2)}%`}
        </div>
      </div>
      <div className="rounded-2xl border border-zinc-200 bg-white p-4 shadow-sm">
        <div className="flex items-center gap-2 text-xs uppercase tracking-[0.25em] text-zinc-500">
          <Layers3 className="size-4" />
          Liquidity
        </div>
        <div className="mt-2 text-2xl font-black">
          {compactFormat.format(stats.visibleLiquidity)}
        </div>
      </div>
    </div>
  );
}
