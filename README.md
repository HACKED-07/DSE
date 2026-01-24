# Mini Exchange Backend

A simplified crypto exchange backend that supports:

- Order matching (BUY / SELL)
- Wallet locking before trade
- Partial fills
- Atomic settlement
- Ledger-based balances
- Order cancellation with lock release

This project focuses on **correctness and fund safety**, not UI.

---

## Architecture

There are two services:

### 1. Matching Engine (port 3002)
- Accepts orders
- Maintains in-memory order books
- Matches best bid/ask
- Calls wallet service for lock & settlement

### 2. Wallet Service (port 3001)
- Ledger-based accounting
- Lock table to prevent double-spend
- Atomic settlement using DB transactions

---

## Trade Lifecycle

1. User places order via `/order`
2. Matching engine calls `/wallet/lock`
3. Funds are locked
4. Order enters orderbook
5. Best BUY and SELL are matched
6. `/wallet/settle` is called
7. Ledger updated atomically
8. Locks are reduced or deleted
9. Orders are removed or partially filled

---

## Setup

### 1. Start wallet service
```bash
cd wallet-service
npm install
npx prisma migrate dev
npm run dev

```

### 2. Start matching engine

```bash
cd matching-engine
npm install
npm run dev

```

---

## API Examples

### Credit wallet

```bash
curl -X POST http://localhost:3001/wallet/credit \
  -H "Content-Type: application/json" \
  -d '{"userId":1,"asset":"USDT","amount":10000}'

curl -X POST http://localhost:3001/wallet/credit \
  -H "Content-Type: application/json" \
  -d '{"userId":2,"asset":"BTC","amount":5}'

```

### Place BUY order

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

### Place SELL order

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

## Design Notes

* Uses locks instead of direct balance updates before trade
* Uses ledger entries instead of mutable balances
* Settlement runs inside a single DB transaction
* Prevents double-spend and partial settlement bugs

## Limitations

* In-memory orderbook
* No persistence for orders
* No WebSocket price feed
* No frontend

*These were intentionally skipped to focus on core correctness.*
