import {
  creditAsset,
  fetchBalances,
  fetchSnapshot,
  listMarkets,
  type Order,
  randomBetween,
  randomInt,
  roundQty,
  sleep,
  submitOrder,
  type Balances,
  type MarketConfig,
} from "./bot-utils";

const TAKER_USER_ID = Number(process.env.TAKER_USER_ID ?? 9101);
const MAKER_USER_ID = Number(process.env.MAKER_USER_ID ?? 9001);
const LOOP_MS = Number(process.env.TAKER_LOOP_MS ?? 1800);
const MATCH_PROBABILITY = Number(process.env.TAKER_MATCH_PROBABILITY ?? 0.55);
const JITTER_MS = Number(process.env.TAKER_JITTER_MS ?? 2200);
const BOOTSTRAP = process.env.TAKER_BOOTSTRAP === "true";
const TAKE_ONLY_MAKER = process.env.TAKER_ONLY_MAKER !== "false";
const DEPTH_WINDOW = Number(process.env.TAKER_DEPTH_WINDOW ?? 4);

const lastActionAt = new Map<string, number>();

async function maybeBootstrap(markets: MarketConfig[]) {
  if (!BOOTSTRAP) {
    return;
  }

  const balances = await fetchBalances(TAKER_USER_ID).catch(() => ({} as Balances));
  if ((balances.USDT?.available ?? 0) < 100000) {
    await creditAsset(TAKER_USER_ID, "USDT", 150000);
  }

  for (const market of markets) {
    const availableBase = balances[market.baseAsset]?.available ?? 0;
    if (availableBase < market.quoteQty * 20) {
      await creditAsset(TAKER_USER_ID, market.baseAsset, market.quoteQty * 200);
    }
  }
}

function shouldThrottle(market: string) {
  const now = Date.now();
  const lastRun = lastActionAt.get(market) ?? 0;
  const nextInterval = LOOP_MS + randomInt(0, Math.max(JITTER_MS, 0));
  if (now - lastRun < nextInterval) {
    return true;
  }

  lastActionAt.set(market, now);
  return false;
}

function pickCandidate(orders: Order[]) {
  if (orders.length === 0) {
    return null;
  }

  return orders[randomInt(0, orders.length - 1)] ?? null;
}

async function maybeTake(config: MarketConfig) {
  if (shouldThrottle(config.market)) {
    return;
  }

  if (Math.random() > MATCH_PROBABILITY) {
    return;
  }

  const snapshot = await fetchSnapshot(config.symbol);
  const askCandidates = snapshot.depth.sells
    .filter(
      (order) =>
        order.remainingQty > 0 &&
        (!TAKE_ONLY_MAKER || order.userId === MAKER_USER_ID),
    )
    .slice(0, DEPTH_WINDOW);
  const bidCandidates = snapshot.depth.buys
    .filter(
      (order) =>
        order.remainingQty > 0 &&
        (!TAKE_ONLY_MAKER || order.userId === MAKER_USER_ID),
    )
    .slice(0, DEPTH_WINDOW);
  const makerAsk = pickCandidate(askCandidates);
  const makerBid = pickCandidate(bidCandidates);

  if (!makerAsk && !makerBid) {
    return;
  }

  const takeAsk = Boolean(makerAsk && (!makerBid || Math.random() >= 0.5));

  if (takeAsk && makerAsk) {
    const qty = roundQty(
      Math.min(
        config.quoteQty * randomBetween(0.25, 0.9),
        makerAsk.remainingQty,
      ),
    );
    console.log(
      `[taker] lifting ask on ${config.market} against user ${makerAsk.userId} qty=${qty} price=${makerAsk.price}`,
    );
    await submitOrder(
      TAKER_USER_ID,
      "taker",
      config.market,
      "BUY",
      makerAsk.price,
      qty,
    );
    return;
  }

  if (makerBid) {
    const qty = roundQty(
      Math.min(
        config.quoteQty * randomBetween(0.25, 0.9),
        makerBid.remainingQty,
      ),
    );
    console.log(
      `[taker] hitting bid on ${config.market} against user ${makerBid.userId} qty=${qty} price=${makerBid.price}`,
    );
    await submitOrder(
      TAKER_USER_ID,
      "taker",
      config.market,
      "SELL",
      makerBid.price,
      qty,
    );
  }
}

async function main() {
  const markets = await listMarkets();
  await maybeBootstrap(markets);

  console.log(
    `[taker] running for user ${TAKER_USER_ID} targeting maker ${MAKER_USER_ID} across ${markets.length} markets`,
  );

  while (true) {
    for (const market of markets) {
      try {
        await maybeTake(market);
      } catch (error) {
        console.error(`[taker] cycle failed for ${market.market}`, error);
      }
    }

    await sleep(LOOP_MS);
  }
}

main().catch((error) => {
  console.error("[taker] fatal error", error);
  process.exit(1);
});
