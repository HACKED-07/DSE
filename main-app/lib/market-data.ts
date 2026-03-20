import { MARKET_PAIRS, type MarketPair, type MarketSymbol } from "@/lib/markets";

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

type Candle = {
  bucket: number;
  open: number;
  high: number;
  low: number;
  close: number;
};

type SnapshotResponse = {
  market: string;
  symbol: string;
  bestBid: RawOrder | null;
  bestAsk: RawOrder | null;
  spread: number | null;
  midPrice: number | null;
  depth: OrderBookSnapshot;
};

export type MarketStats = {
  symbol: MarketSymbol;
  lastPrice: number | null;
  changePercent: number | null;
  visibleLiquidity: number;
  spread: number | null;
};

export type ResolvedMarket = MarketPair & {
  stats: MarketStats;
};

const ENGINE_URL = process.env.NEXT_PUBLIC_ENGINE_URL ?? "http://localhost:3002";

async function getJson<T>(path: string) {
  const response = await fetch(`${ENGINE_URL}${path}`, {
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch ${path}`);
  }

  return (await response.json()) as T;
}

function computeLiquidity(snapshot: SnapshotResponse) {
  const allOrders = [...snapshot.depth.buys, ...snapshot.depth.sells];
  return allOrders.reduce(
    (total, order) => total + order.price * Math.max(order.remainingQty, 0),
    0,
  );
}

function computeChangePercent(candles: Candle[]) {
  if (candles.length === 0) {
    return null;
  }

  const first = candles[0];
  const last = candles[candles.length - 1];
  if (!first || !last || first.open === 0) {
    return null;
  }

  return ((last.close - first.open) / first.open) * 100;
}

export async function getMarketStats(symbol: MarketSymbol): Promise<MarketStats> {
  try {
    const [snapshot, ohlc] = await Promise.all([
      getJson<SnapshotResponse>(`/snapshot/${symbol}`),
      getJson<{ candles?: Candle[] }>(`/ohlc/${symbol}`),
    ]);

    const candles = Array.isArray(ohlc.candles) ? ohlc.candles : [];
    const lastPrice =
      candles.length > 0
        ? candles[candles.length - 1]?.close ?? null
        : snapshot.midPrice ??
          snapshot.bestBid?.price ??
          snapshot.bestAsk?.price ??
          null;

    return {
      symbol,
      lastPrice,
      changePercent: computeChangePercent(candles),
      visibleLiquidity: computeLiquidity(snapshot),
      spread: snapshot.spread,
    };
  } catch {
    return {
      symbol,
      lastPrice: null,
      changePercent: null,
      visibleLiquidity: 0,
      spread: null,
    };
  }
}

export async function getAllResolvedMarkets(): Promise<ResolvedMarket[]> {
  const statsEntries = await Promise.all(
    MARKET_PAIRS.map(async (market) => [market.symbol, await getMarketStats(market.symbol)] as const),
  );
  const statsMap = new Map(statsEntries);

  return MARKET_PAIRS.map((market) => ({
    ...market,
    stats: statsMap.get(market.symbol)!,
  }));
}
