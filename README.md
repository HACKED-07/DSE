# Mini Exchange Backend

A minimal crypto exchange backend designed to demonstrate **correct trade settlement, balance safety, and partial-fill handling**.

This system intentionally avoids UI, persistence, and real networking complexity to focus on **core correctness problems in trading systems**:

* Double-spend prevention
* Partial fill settlement
* Atomic balance updates
* Lock-based fund control

---

## Architecture

Two independent services communicate over HTTP.

### 1) Matching Engine (port `3002`)

* Accepts orders
* Maintains in-memory order books
* Matches best bid/ask
* Requests balance locks before accepting orders
* Calls wallet service to settle matched trades

### 2) Wallet Service (port `3001`)

* Ledger-based accounting (no mutable balances)
* Lock table prevents double-spend
* Atomic settlement using DB transactions
* Idempotent trade settlement via `ref`

This mirrors how real exchanges split **price discovery** and **fund custody**.

---

## Trade Lifecycle

1. Client sends order to `/order`
2. Matching engine requests `/wallet/lock`
3. Wallet validates available balance and creates a lock
4. Order is inserted into orderbook
5. Engine matches best BUY and SELL
6. `/wallet/settle` is called with both lock refs
7. Ledger rows are written atomically
8. Lock rows are reduced or deleted
9. Orders are removed or partially filled

At no point are funds moved without a verified lock.

---

## Design Notes

### Atomic Settlement

Settlement is performed inside a single database transaction:

* Buyer USDT is debited
* Seller BTC is debited
* Seller receives USDT
* Buyer receives BTC

If any step fails, **none of them commit**.
This prevents partial state corruption.

---

### Lock-Based Balance Control

Balances are never directly checked.

Instead:

```
available = ledger_sum - locked_sum
```

This prevents:

* overspending
* race conditions
* inconsistent reads

Locks act as **temporary ownership claims**.

---

### Idempotent Trade Execution

Each settlement uses a unique `ref`.

Before executing, the wallet checks:

```ts
tx.ledger.findFirst({ where: { ref } })
```

If found, the trade is skipped.

This prevents:

* duplicate settlements
* retry bugs
* replay attacks

---

### Partial Fills

Locks are **not released** on partial trades.

Instead:

```ts
lock.amount -= traded_amount
```

Only when the amount reaches zero is the lock deleted.

This mirrors how real exchanges maintain remaining order collateral.

---

## Setup

### Wallet Service

```bash
cd wallet-service
npm install
npx prisma migrate dev
npm run dev
```

### Matching Engine

```bash
cd matching-engine
npm install
npm run dev
```

---

## API Demo

### Fund Users

```bash
curl -X POST http://localhost:3001/wallet/credit \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"asset":"USDT","amount":10000}'

curl -X POST http://localhost:3001/wallet/credit \
  -H "Content-Type: application/json" \
  -d '{"userId":2,"asset":"BTC","amount":5}'
```

### Place BUY

```bash
curl -X POST http://localhost:3002/order \
  -H "Content-Type: application/json" \
  -d '{
    "userId":1,
    "price":30000,
    "qty":1,
    "orderType":"BUY",
    "market":"BTC/USDT"
  }'
```

### Place SELL

```bash
curl -X POST http://localhost:3002/order \
  -H "Content-Type: application/json" \
  -d '{
    "userId":2,
    "price":30000,
    "qty":1,
    "orderType":"SELL",
    "market":"BTC/USDT"
  }'
```

### Cancel Order

```bash
curl -X POST http://localhost:3002/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "userId":1,
    "orderId":"<lockRef>",
    "market":"BTC/USDT"
  }'
```

---

## Limitations

* In-memory orderbook
* No persistence for orders
* No WebSockets
* No frontend

These were intentionally excluded to isolate **core financial correctness**.

---

## Demo Liquidity Bots

The matching engine now includes two dedicated bot entrypoints:

* [matching-engine/src/makerBot.ts](/Users/hrishikeshpatel/Desktop/Folder/projects/DSE/matching-engine/src/makerBot.ts)
* [matching-engine/src/takerBot.ts](/Users/hrishikeshpatel/Desktop/Folder/projects/DSE/matching-engine/src/takerBot.ts)

What they do:

* the maker bot continuously refreshes multi-level passive quotes across all markets
* the taker bot continuously and randomly crosses liquidity from a small depth window
* by default the taker bot targets the maker bot's quotes, so fills occur without self-trading

Run them in separate terminals:

```bash
cd matching-engine
MAKER_USER_ID=9001 MAKER_BOOTSTRAP=true npm run maker-bot
```

```bash
cd matching-engine
TAKER_USER_ID=9101 MAKER_USER_ID=9001 TAKER_BOOTSTRAP=true npm run taker-bot
```

Useful maker environment variables:

* `MAKER_USER_ID` maker account id, default `9001`
* `MAKER_BOOTSTRAP=true` auto-funds the maker through the wallet credit endpoint
* `MAKER_LOOP_MS` quote refresh interval, default `4000`
* `MAKER_QUOTE_SPREAD_BPS` total maker spread in basis points, default `30`
* `MAKER_QUOTE_LEVELS` number of maker orders per side, default `4`
* `MAKER_LEVEL_STEP_BPS` extra basis points between quote levels, default `14`
* `MAKER_REPRICE_THRESHOLD_BPS` minimum drift before cancel/requote, default `8`

Useful taker environment variables:

* `TAKER_USER_ID` taker account id, default `9101`
* `TAKER_BOOTSTRAP=true` auto-funds the taker through the wallet credit endpoint
* `MAKER_USER_ID` maker account id to target, default `9001`
* `TAKER_LOOP_MS` taker scan interval, default `1800`
* `TAKER_JITTER_MS` random extra delay before a taker action, default `2200`
* `TAKER_MATCH_PROBABILITY` chance of a taker action per market cycle, default `0.55`
* `TAKER_DEPTH_WINDOW` number of top levels the taker can choose from, default `4`
* `TAKER_ONLY_MAKER` when `true` targets only the maker bot's quotes, default `true`

Bot-facing engine endpoints:

* `GET /markets` lists all supported markets
* `GET /snapshot/:symbol` returns top-of-book, spread, and depth
* `POST /order` now returns the created `orderId`

These bots are set up as **demo local exchange participants**. The maker adds laddered liquidity across several prices, and the taker removes liquidity with randomized timing, side selection, and price-level choice. They are not appropriate for real-market deployment without exchange-specific controls, rate limiting, inventory/risk management, and legal/compliance review.
