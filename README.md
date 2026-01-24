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
