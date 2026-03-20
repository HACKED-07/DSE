export const MARKET_PAIRS = [
  {
    symbol: "BTC_USDT",
    baseAsset: "BTC",
    quoteAsset: "USDT",
    name: "Bitcoin",
    accent: "from-amber-400/20 via-yellow-300/8 to-transparent",
  },
  {
    symbol: "ETH_USDT",
    baseAsset: "ETH",
    quoteAsset: "USDT",
    name: "Ethereum",
    accent: "from-sky-400/20 via-cyan-300/8 to-transparent",
  },
  {
    symbol: "DOGE_USDT",
    baseAsset: "DOGE",
    quoteAsset: "USDT",
    name: "Dogecoin",
    accent: "from-lime-400/20 via-emerald-300/8 to-transparent",
  },
  {
    symbol: "DIDE_USDT",
    baseAsset: "DIDE",
    quoteAsset: "USDT",
    name: "Dide",
    accent: "from-rose-400/20 via-orange-300/8 to-transparent",
  },
] as const;

export type MarketPair = (typeof MARKET_PAIRS)[number];
export type MarketSymbol = MarketPair["symbol"];
export type BaseAsset = MarketPair["baseAsset"];

export const DEFAULT_MARKET_SYMBOL: MarketSymbol = "BTC_USDT";

export function getMarketBySymbol(symbol: string) {
  return MARKET_PAIRS.find((market) => market.symbol === symbol);
}

export function getMarketByBaseAsset(baseAsset: string) {
  return MARKET_PAIRS.find((market) => market.baseAsset === baseAsset);
}

export function isValidMarketSymbol(symbol: string): symbol is MarketSymbol {
  return MARKET_PAIRS.some((market) => market.symbol === symbol);
}
