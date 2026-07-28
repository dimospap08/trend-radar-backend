# Trend Radar — Backend

Real, deployable API for the Trend Radar frontend: trend feed, watchlist,
and Stripe subscriptions. What's NOT included, and why:

## What works out of the box
- Express API (`/api/trends`, `/api/billing/checkout`, `/api/billing/webhook`)
- PostgreSQL schema (`db/schema.sql`) — users, subscriptions, trends, watchlist, alerts
- Trend scoring algorithm (`services/scoring.js`) — velocity + acceleration +
  persistence, with a noise filter so one-off spikes don't get promoted
- Stripe Checkout + webhook handling for Free / Pro / Signal+ tiers

## What you must add yourself (and why I can't)
1. **Data source connectors** (not included). To fill `raw_signals`, you need
   ingestion workers that pull from:
   - TikTok Creative Center / Research API
   - X (Twitter) API v2 (recent search / volume)
   - Google Trends (unofficial libs like `google-trends-api`, or paid Trends API)
   - Dexscreener / Birdeye / Moralis for on-chain meme-coin volume
   Each requires its own developer account and API keys tied to *you*, so
   I can't create or embed working credentials on your behalf.
2. **A running Postgres database** — run `db/schema.sql` against your own
   instance (Supabase, Railway, RDS, etc. all work).
3. **A Stripe account** — create the Pro/Investor Prices in the Stripe
   dashboard, then drop the price IDs and secret key into `.env`.
4. **Hosting** — deploy this (Render, Railway, Fly.io, a VPS...) and point
   `APP_URL` / your frontend's API base URL at it.

## Setup
```bash
cp .env.example .env      # fill in your real values
npm install
psql $DATABASE_URL -f db/schema.sql
npm run dev
```

## Suggested ingestion cron (not included, sketch only)
A worker that runs every 15 min: fetch latest metric per tracked item from
each source → insert into `raw_signals` → run `scoreSeries()` per item →
upsert into `trends` if it passes `passesNoiseFilter()`.

## Connecting the frontend
The React dashboard (`trend-radar-en.jsx`) currently uses generated mock
data. To go live, replace its local `ALL_TRENDS` array with a fetch to
`GET /api/trends?persona=creator&tier=pro`, and point the pricing buttons
at `POST /api/billing/checkout`.
