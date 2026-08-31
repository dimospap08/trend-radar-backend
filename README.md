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

## What's mock vs real right now
- Trend data: generated locally (fake, deterministic) — see `src/TrendRadar.jsx`.
- Watchlist: saved in the browser's localStorage (real, but per-device only).
- Pricing buttons: visual only, not wired to Stripe yet.

Once the backend (see the other zip I sent you) is deployed, two edits turn
this into a live product:
1. Replace the local `ALL_TRENDS` array with a `fetch('/api/trends?...')` call.
2. Point the pricing "Choose plan" button at `POST /api/billing/checkout`.
