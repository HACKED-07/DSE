# DSE — Decentralized Spot Exchange

A full-stack crypto exchange built to demonstrate **correct trade settlement, balance safety, partial-fill handling**, and a polished trading UI — all running locally.

```
main-app  ←→  matching-engine  ←→  wallet-service
 (Next.js)    (Express + WS)       (Express + Prisma)
                    ↕                      ↕
                  Kafka  ──────────────→  Kafka
               (producer)              (consumer)
```

---

## Architecture

Three independent services communicate over HTTP, WebSockets, and Kafka.

### 1) Main App — Next.js Frontend (port `3000`)

* Next.js 16 with App Router and server components
* **NextAuth v5** with Google OAuth and Prisma adapter
* Real-time order book via Socket.IO client
* Candlestick chart powered by `lightweight-charts`
* Server-side API route proxies inject the authenticated user ID before forwarding to backend services
* Pages: landing page, authenticated dashboard with live market cards, per-market trading surface

### 2) Matching Engine (port `3002`)

* In-memory order books for 4 markets: `BTC/USDT`, `ETH/USDT`, `DOGE/USDT`, `DIDE/USDT`
* Price-time priority matching with self-trade prevention
* **Socket.IO server** broadcasts order book deltas to connected clients
* Publishes trade settlements to Kafka (`trade.settlement` topic)
* OHLC candlestick aggregation (1-minute buckets)
* Snapshot and depth endpoints for server-side rendering

### 3) Wallet Service (port `3001`)

* Ledger-based accounting — no mutable balances
* Lock table prevents double-spend
* Atomic settlement using Prisma transactions with `pg_advisory_xact_lock`
* **Kafka consumer** processes settlements asynchronously from the matching engine
* Idempotent trade settlement via unique `ref` values
* Refactored into routes → controllers → services architecture
* String user IDs (compatible with NextAuth-generated UUIDs)

---

## Trade Lifecycle

1. User submits an order through the frontend trade form
2. Next.js API route injects the authenticated user ID and forwards to matching engine
3. Matching engine requests `POST /wallet/lock` to reserve funds
4. Wallet validates available balance and creates a lock row
5. Order is inserted into the in-memory order book
6. Engine matches best BUY and SELL at price-time priority
7. Settlement message is published to Kafka (`trade.settlement`)
8. Wallet service consumes the message and settles atomically inside a DB transaction
9. Ledger rows are written, lock rows are reduced or deleted
10. Socket.IO broadcasts order book changes to all subscribers

At no point are funds moved without a verified lock.

---

## Design Notes

### Atomic Settlement

Settlement is performed inside a single database transaction:

* Buyer's quote asset (USDT) is debited
* Seller's base asset (BTC) is debited
* Seller receives USDT
* Buyer receives BTC

If any step fails, **none of them commit**.

---

### Lock-Based Balance Control

Balances are never directly checked. Instead:

```
available = ledger_sum - locked_sum
```

This prevents overspending, race conditions, and inconsistent reads.
Locks act as **temporary ownership claims**.

---

### Idempotent Trade Execution

Each settlement uses a unique `ref`. Before executing, the wallet checks:

```ts
tx.ledger.findFirst({ where: { ref } })
```

If found, the trade is skipped — preventing duplicate settlements, retry bugs, and replay attacks.

---

### Partial Fills

Locks are **not released** on partial trades. Instead:

```ts
lock.amount -= traded_amount
```

Only when the amount reaches zero is the lock deleted.

---

### Kafka-Based Settlement

Trade settlement is decoupled from the matching loop. The matching engine publishes to `trade.settlement` and the wallet service consumes messages in the background. This prevents settlement latency from blocking order matching.

---

## Prerequisites

* **Node.js** ≥ 18
* **PostgreSQL** — two databases (one for NextAuth users, one for the wallet ledger)
* **Apache Kafka** — running locally (default `localhost:9092`)

---

## Setup

### 1. Wallet Service

```bash
cd wallet-service
npm install
npx prisma migrate dev
npm run dev          # → http://localhost:3001
```

### 2. Matching Engine

```bash
cd matching-engine
npm install
npm run dev          # → http://localhost:3002
```

### 3. Main App (Frontend)

```bash
cd main-app
cp .env.local.example .env.local   # configure Google OAuth + DB URLs
npm install
npx prisma migrate dev
npm run dev          # → http://localhost:3000
```

> **Note:** All three services must be running simultaneously.

---

## API Demo

### Fund a User

```bash
curl -X POST http://localhost:3001/wallet/credit \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_abc123","asset":"USDT","amount":10000}'

curl -X POST http://localhost:3001/wallet/credit \
  -H "Content-Type: application/json" \
  -d '{"userId":"user_xyz789","asset":"BTC","amount":5}'
```

### Place a BUY Order

```bash
curl -X POST http://localhost:3002/order \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"user_abc123",
    "price":30000,
    "qty":1,
    "orderType":"BUY",
    "market":"BTC/USDT"
  }'
```

### Place a SELL Order

```bash
curl -X POST http://localhost:3002/order \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"user_xyz789",
    "price":30000,
    "qty":1,
    "orderType":"SELL",
    "market":"BTC/USDT"
  }'
```

### Cancel an Order

```bash
curl -X POST http://localhost:3002/cancel \
  -H "Content-Type: application/json" \
  -d '{
    "userId":"user_abc123",
    "orderId":"<lockRef>",
    "market":"BTC/USDT"
  }'
```

---

## Frontend

The Next.js frontend provides a complete exchange interface:

| Page | Route | Description |
|------|-------|-------------|
| Landing | `/` | Hero section with market preview cards (unauthenticated) |
| Dashboard | `/` | Welcome banner, live market stats, market picker (authenticated) |
| Trading | `/market/[symbol]` | Chart, real-time order book, trade form, market sidebar |

**Key components:**

* **OrderBook** — real-time WebSocket updates with depth bars, bid/ask pressure indicator, mid-price with direction arrows
* **TradeForm** — BUY/SELL toggle, live balance display, order placement with instant order book resync
* **DepositModal** — portal-based modal for depositing test USDT with preset amounts and live balance
* **Chart** — candlestick chart using `lightweight-charts` with auto-resize
* **LiveMarketStats** — price, change %, and liquidity cards that refresh via WebSocket + polling

---

## Limitations

* In-memory order book (orders lost on engine restart)
* No order persistence or order history
* Demo-only authentication (Google OAuth for local testing)
* Single-node Kafka (no replication or partitioning)

These are intentional to keep the focus on **core financial correctness**.

---

## Demo Liquidity Bots

The matching engine includes two bot entrypoints for generating realistic market activity:

### Run Bots

```bash
# Terminal 1 — Maker bot (passive quotes)
cd matching-engine
MAKER_USER_ID=9001 MAKER_BOOTSTRAP=true npm run maker-bot

# Terminal 2 — Taker bot (crosses liquidity)
cd matching-engine
TAKER_USER_ID=9101 MAKER_USER_ID=9001 TAKER_BOOTSTRAP=true npm run taker-bot
```

### Maker Bot Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `MAKER_USER_ID` | `9001` | Maker account ID |
| `MAKER_BOOTSTRAP` | `false` | Auto-fund via wallet credit endpoint |
| `MAKER_LOOP_MS` | `4000` | Quote refresh interval |
| `MAKER_QUOTE_SPREAD_BPS` | `30` | Total spread in basis points |
| `MAKER_QUOTE_LEVELS` | `4` | Orders per side |
| `MAKER_LEVEL_STEP_BPS` | `14` | Extra bps between levels |
| `MAKER_REPRICE_THRESHOLD_BPS` | `8` | Min drift before requote |

### Taker Bot Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `TAKER_USER_ID` | `9101` | Taker account ID |
| `TAKER_BOOTSTRAP` | `false` | Auto-fund via wallet credit endpoint |
| `MAKER_USER_ID` | `9001` | Maker to target |
| `TAKER_LOOP_MS` | `1800` | Scan interval |
| `TAKER_JITTER_MS` | `2200` | Random extra delay |
| `TAKER_MATCH_PROBABILITY` | `0.55` | Action probability per cycle |
| `TAKER_DEPTH_WINDOW` | `4` | Top levels to choose from |
| `TAKER_ONLY_MAKER` | `true` | Target only maker bot quotes |

### Bot-Facing Engine Endpoints

* `GET /markets` — lists all supported markets
* `GET /snapshot/:symbol` — top-of-book, spread, and depth
* `POST /order` — returns the created `orderId`

> These bots are **demo participants only**. They are not suitable for production use without exchange-specific controls, rate limiting, inventory management, and compliance review.
