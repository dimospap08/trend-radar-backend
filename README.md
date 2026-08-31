# Trend Radar — Frontend (deploy-ready)

This is a complete, ready-to-deploy Vite + React + Tailwind project.

## Deploy to Vercel (no local setup needed)
1. Go to vercel.com and sign up (GitHub login is easiest).
2. Click **Add New → Project**.
3. When it asks for a Git repo, instead choose to upload this folder directly
   (Vercel supports drag-and-drop deploy under "Deploy without Git" /
   via the Vercel CLI: `npx vercel` from inside this folder — it will
   ask a few yes/no questions, then give you a live URL).
4. Framework preset: Vite. Build command: `npm run build`. Output dir: `dist`.
5. Deploy. You'll get a live link like `trend-radar.vercel.app`.

## Or run it locally first
```bash
npm install
npm run dev
```
Opens at http://localhost:5173

## Run the backend locally

Create `.env.local` and set `DATABASE_URL` to the PostgreSQL connection string
from the Supabase project. Keep this file private; it is ignored by Git.

```bash
npm run start:backend
```

The API runs at http://localhost:4000. Check it with:

```text
GET /health
GET /api/trends?persona=creator&tier=pro
POST /api/trends/refresh-free
```

## What's real vs not connected yet
- Trend feed: loaded from Supabase, with Google Trends RSS and GDELT ingestion.
- Radar and ticker: use the same live trend records shown in the feed.
- Watchlist: saved in the browser's localStorage (real, but per-device only).
- Pricing buttons: visual only, not wired to Stripe yet.

Once the backend (see the other zip I sent you) is deployed, two edits turn
this into a live product:
1. Add richer authenticated account settings and notification preferences.
2. Point the pricing "Choose plan" button at `POST /api/billing/checkout`.
