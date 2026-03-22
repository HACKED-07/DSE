import axios from "axios";

export type Side = "BUY" | "SELL";

export type Order = {
  orderId: string;
  userId: string;
  price: number;
  originalQty: number;
  remainingQty: number;
  orderType: Side;
  market: string;
  timestamp: number;
};

export type Snapshot = {
  market: string;
  symbol: string;
  bestBid: Order | null;
  bestAsk: Order | null;
  spread: number | null;
  midPrice: number | null;
  depth: {
    buys: Order[];
    sells: Order[];
  };
};

export type Balances = Record<
  string,
  {
    total: number;
    locked: number;
    available: number;
  }
>;

export type MarketConfig = {
  market: string;
  symbol: string;
  baseAsset: string;
  quoteAsset: string;
  anchorPrice: number;
  quoteQty: number;
};

export const ENGINE_URL = process.env.ENGINE_URL ?? "http://localhost:3002";
export const WALLET_URL = process.env.WALLET_URL ?? "http://localhost:3001";

const MARKET_DEFAULTS: Record<string, Omit<MarketConfig, "market" | "symbol">> = {
  "BTC/USDT": {
    baseAsset: "BTC",
    quoteAsset: "USDT",
    anchorPrice: 30000,
    quoteQty: 0.02,
  },
  "ETH/USDT": {
    baseAsset: "ETH",
    quoteAsset: "USDT",
    anchorPrice: 2000,
    quoteQty: 0.2,
  },
  "DOGE/USDT": {
    baseAsset: "DOGE",
    quoteAsset: "USDT",
    anchorPrice: 0.2,
    quoteQty: 200,
  },
  "DIDE/USDT": {
    baseAsset: "DIDE",
    quoteAsset: "USDT",
    anchorPrice: 1,
    quoteQty: 50,
  },
};

export const roundPrice = (value: number) => Number(value.toFixed(8));
export const roundQty = (value: number) => Number(value.toFixed(8));

export const bpsDistance = (left: number, right: number) =>
  (Math.abs(left - right) / Math.max(right, 0.00000001)) * 10000;

export const randomBetween = (min: number, max: number) =>
  min + Math.random() * (max - min);

export const randomInt = (min: number, max: number) =>
  Math.floor(randomBetween(min, max + 1));

export const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export const getAxiosResponseData = (error: unknown) => {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: unknown }).response === "object"
  ) {
    return (error as { response?: { data?: unknown } }).response?.data;
  }

  return null;
};

export async function listMarkets(): Promise<MarketConfig[]> {
  const response = await axios.get<{ markets: { market: string; symbol: string }[] }>(
    `${ENGINE_URL}/markets`,
  );

  return response.data.markets.map(({ market, symbol }) => {
    const defaults = MARKET_DEFAULTS[market];
    if (!defaults) {
      const [baseAsset, quoteAsset] = market.split("/");
      return {
        market,
        symbol,
        baseAsset,
        quoteAsset,
        anchorPrice: 1,
        quoteQty: 1,
      };
    }

    return {
      market,
      symbol,
      ...defaults,
    };
  });
}

export async function fetchSnapshot(symbol: string) {
  const response = await axios.get<Snapshot>(`${ENGINE_URL}/snapshot/${symbol}`);
  return response.data;
}

export async function fetchBalances(userId: string) {
  const response = await axios.get<Balances>(`${WALLET_URL}/wallet/balance/${userId}`);
  return response.data;
}

export async function creditAsset(userId: string, asset: string, amount: number) {
  await axios.post(`${WALLET_URL}/wallet/credit`, {
    userId,
    asset,
    amount,
  });
  console.log(`[bot] funded ${asset} with ${amount} for user ${userId}`);
}

export async function submitOrder(
  userId: string,
  actorLabel: string,
  market: string,
  side: Side,
  price: number,
  qty: number,
) {
  try {
    const response = await axios.post<{ orderId: string }>(`${ENGINE_URL}/order`, {
      userId,
      price: roundPrice(price),
      qty: roundQty(qty),
      orderType: side,
      market,
    });

    console.log(
      `[${actorLabel}] placed ${side} ${market} qty=${roundQty(qty)} price=${roundPrice(price)} orderId=${response.data.orderId}`,
    );
    return response.data.orderId;
  } catch (error) {
    const responseData = getAxiosResponseData(error);
    if (responseData) {
      console.log(
        `[${actorLabel}] ${market} ${side} rejected:`,
        JSON.stringify(responseData),
      );
      return null;
    }

    throw error;
  }
}

export async function cancelOrder(
  userId: string,
  actorLabel: string,
  orderId: string,
  market: string,
) {
  try {
    await axios.post(`${ENGINE_URL}/cancel`, {
      userId,
      orderId,
      market,
    });
    console.log(`[${actorLabel}] canceled ${market} orderId=${orderId}`);
  } catch (error) {
    const responseData = getAxiosResponseData(error);
    if (responseData) {
      console.log(
        `[${actorLabel}] ${market} cancel skipped:`,
        JSON.stringify(responseData),
      );
      return;
    }

    throw error;
  }
}
