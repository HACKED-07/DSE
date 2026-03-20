import {
  bpsDistance,
  cancelOrder,
  creditAsset,
  fetchBalances,
  fetchSnapshot,
  listMarkets,
  randomBetween,
  roundPrice,
  roundQty,
  sleep,
  submitOrder,
  type Balances,
  type MarketConfig,
  type Side,
  type Snapshot,
} from "./bot-utils";

type QuoteOrder = {
  orderId: string;
  price: number;
  qty: number;
};

type MarketQuoteState = {
  buys: QuoteOrder[];
  sells: QuoteOrder[];
  lastBuySkipReason: string | null;
  lastSellSkipReason: string | null;
};

const MAKER_USER_ID = Number(process.env.MAKER_USER_ID ?? 9001);
const LOOP_MS = Number(process.env.MAKER_LOOP_MS ?? 4000);
const QUOTE_SPREAD_BPS = Number(process.env.MAKER_QUOTE_SPREAD_BPS ?? 30);
const QUOTE_LEVELS = Number(process.env.MAKER_QUOTE_LEVELS ?? 4);
const LEVEL_STEP_BPS = Number(process.env.MAKER_LEVEL_STEP_BPS ?? 14);
const REPRICE_THRESHOLD_BPS = Number(
  process.env.MAKER_REPRICE_THRESHOLD_BPS ?? 8,
);
const BOOTSTRAP = process.env.MAKER_BOOTSTRAP === "true";

const quoteState = new Map<string, MarketQuoteState>();
const fairValueState = new Map<string, number>();

function fairPrice(snapshot: Snapshot, config: MarketConfig) {
  const previousFair = fairValueState.get(config.market) ?? config.anchorPrice;
  const randomWalkBps = randomBetween(-6, 6) / 10000;

  if (snapshot.bestBid && snapshot.bestAsk) {
    const bookMid = (snapshot.bestBid.price + snapshot.bestAsk.price) / 2;
    const smoothed = previousFair * 0.4 + bookMid * 0.6;
    const nextFair = roundPrice(smoothed * (1 + randomWalkBps));
    fairValueState.set(config.market, nextFair);
    return nextFair;
  }

  if (snapshot.bestBid) {
    const nextFair = roundPrice(snapshot.bestBid.price * (1.001 + randomWalkBps));
    fairValueState.set(config.market, nextFair);
    return nextFair;
  }

  if (snapshot.bestAsk) {
    const nextFair = roundPrice(snapshot.bestAsk.price * (0.999 + randomWalkBps));
    fairValueState.set(config.market, nextFair);
    return nextFair;
  }

  const nextFair = roundPrice(previousFair * (1 + randomWalkBps));
  fairValueState.set(config.market, nextFair);
  return nextFair;
}

async function maybeBootstrap(markets: MarketConfig[]) {
  if (!BOOTSTRAP) {
    return;
  }

  const balances = await fetchBalances(MAKER_USER_ID).catch(() => ({} as Balances));
  const availableUsdt = balances.USDT?.available ?? 0;

  if (availableUsdt < 250000) {
    await creditAsset(MAKER_USER_ID, "USDT", 500000);
  }

  for (const market of markets) {
    const neededBase = market.quoteQty * QUOTE_LEVELS * 3;
    const availableBase = balances[market.baseAsset]?.available ?? 0;
    if (availableBase < neededBase) {
      await creditAsset(MAKER_USER_ID, market.baseAsset, neededBase * 10);
    }
  }
}

function getState(market: string): MarketQuoteState {
  return (
    quoteState.get(market) ?? {
      buys: [],
      sells: [],
      lastBuySkipReason: null,
      lastSellSkipReason: null,
    }
  );
}

function buildDesiredQuotes(config: MarketConfig, fair: number, side: Side) {
  const orders: { price: number; qty: number }[] = [];
  const baseHalfSpread = QUOTE_SPREAD_BPS / 20000;

  for (let index = 0; index < QUOTE_LEVELS; index += 1) {
    const distanceBps = baseHalfSpread + (index * LEVEL_STEP_BPS) / 10000;
    const price =
      side === "BUY"
        ? roundPrice(fair * (1 - distanceBps))
        : roundPrice(fair * (1 + distanceBps));
    const qty = roundQty(config.quoteQty * (1 + index * 0.35));
    orders.push({ price, qty });
  }

  return orders;
}

async function cancelSide(
  market: string,
  side: Side,
  existingOrders: QuoteOrder[],
  keepOrders: QuoteOrder[],
) {
  const keepIds = new Set(keepOrders.map((order) => order.orderId));

  for (const order of existingOrders) {
    if (!keepIds.has(order.orderId)) {
      await cancelOrder(MAKER_USER_ID, "maker", order.orderId, market);
    }
  }

  return existingOrders.filter((order) => keepIds.has(order.orderId));
}

async function syncSide(
  config: MarketConfig,
  side: Side,
  desiredOrders: { price: number; qty: number }[],
  balances: Balances,
) {
  const state = getState(config.market);
  const existingOrders = side === "BUY" ? state.buys : state.sells;
  const skipReasonKey =
    side === "BUY" ? "lastBuySkipReason" : "lastSellSkipReason";

  const requiredQuote = desiredOrders.reduce(
    (sum, order) => sum + order.price * order.qty,
    0,
  );
  const requiredBase = desiredOrders.reduce((sum, order) => sum + order.qty, 0);

  if (
    side === "BUY" &&
    (balances[config.quoteAsset]?.available ?? 0) < requiredQuote
  ) {
    const reason = `insufficient ${config.quoteAsset} available=${balances[config.quoteAsset]?.available ?? 0} required=${roundPrice(requiredQuote)}`;
    if (state[skipReasonKey] !== reason) {
      console.log(`[maker] skip ${side} ${config.market}: ${reason}`);
      state[skipReasonKey] = reason;
      quoteState.set(config.market, state);
    }
    return;
  }

  if (
    side === "SELL" &&
    (balances[config.baseAsset]?.available ?? 0) < requiredBase
  ) {
    const reason = `insufficient ${config.baseAsset} available=${balances[config.baseAsset]?.available ?? 0} required=${roundQty(requiredBase)}`;
    if (state[skipReasonKey] !== reason) {
      console.log(`[maker] skip ${side} ${config.market}: ${reason}`);
      state[skipReasonKey] = reason;
      quoteState.set(config.market, state);
    }
    return;
  }

  if (state[skipReasonKey] !== null) {
    state[skipReasonKey] = null;
  }

  const reusableOrders: QuoteOrder[] = [];

  for (const desiredOrder of desiredOrders) {
    const match = existingOrders.find(
      (existingOrder) =>
        bpsDistance(existingOrder.price, desiredOrder.price) <
          REPRICE_THRESHOLD_BPS &&
        Math.abs(existingOrder.qty - desiredOrder.qty) < 0.0000001,
    );

    if (match) {
      reusableOrders.push(match);
    }
  }

  const keptOrders = await cancelSide(config.market, side, existingOrders, reusableOrders);
  const keptSignature = new Set(keptOrders.map((order) => `${order.price}:${order.qty}`));
  const nextOrders = [...keptOrders];

  for (const desiredOrder of desiredOrders) {
    const signature = `${desiredOrder.price}:${desiredOrder.qty}`;
    if (keptSignature.has(signature)) {
      continue;
    }

    const orderId = await submitOrder(
      MAKER_USER_ID,
      "maker",
      config.market,
      side,
      desiredOrder.price,
      desiredOrder.qty,
    );

    if (orderId) {
      nextOrders.push({
        orderId,
        price: desiredOrder.price,
        qty: desiredOrder.qty,
      });
    }
  }

  if (side === "BUY") {
    state.buys = nextOrders.sort((left, right) => right.price - left.price);
  } else {
    state.sells = nextOrders.sort((left, right) => left.price - right.price);
  }

  quoteState.set(config.market, state);
}

async function runCycle(config: MarketConfig) {
  const snapshot = await fetchSnapshot(config.symbol);
  const fair = fairPrice(snapshot, config);
  const balances = await fetchBalances(MAKER_USER_ID);

  await syncSide(config, "BUY", buildDesiredQuotes(config, fair, "BUY"), balances);
  await syncSide(config, "SELL", buildDesiredQuotes(config, fair, "SELL"), balances);
}

async function main() {
  const markets = await listMarkets();
  await maybeBootstrap(markets);

  console.log(
    `[maker] running for user ${MAKER_USER_ID} across ${markets.length} markets with ${QUOTE_LEVELS} levels per side`,
  );

  while (true) {
    for (const market of markets) {
      try {
        await runCycle(market);
      } catch (error) {
        console.error(`[maker] cycle failed for ${market.market}`, error);
      }
    }

    await sleep(LOOP_MS);
  }
}

main().catch((error) => {
  console.error("[maker] fatal error", error);
  process.exit(1);
});
