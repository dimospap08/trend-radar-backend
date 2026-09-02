require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const { Pool } = require("pg");
const cron = require("node-cron");

const trendsRoutes = require("./routes/trends");
const billingRoutes = require("./routes/billing");
const sportsRoutes = require("./routes/sports");
const { refreshTrends } = require("./services/geminiTrends");
const { persistFreeSignals } = require("./services/freeTrendSources");
const { processAlerts } = require("./services/alerts");

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.locals.pool = pool;

const allowedOrigins = (process.env.CORS_ORIGINS || "https://trendradarpro.com,http://localhost:5173")
  .split(",").map((origin) => origin.trim()).filter(Boolean);
app.use(helmet({ crossOriginResourcePolicy: { policy: "cross-origin" } }));
app.use(cors({ origin(origin, callback) {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  return callback(new Error("Origin not allowed by CORS"));
}}));
app.use(rateLimit({ windowMs: 15 * 60 * 1000, limit: 240, standardHeaders: true, legacyHeaders: false }));

app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

app.use("/api/trends", trendsRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/sports", sportsRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));

cron.schedule("0 * * * *", async () => {
  if (!process.env.GEMINI_API_KEY) {
    console.log("Skipping scheduled trend scan: GEMINI_API_KEY not set");
    return;
  }
  try {
    const result = await refreshTrends(pool, process.env.GEMINI_API_KEY);
    console.log(`Scheduled trend scan complete: found ${result.found}, upserted ${result.upserted}`);
  } catch (err) {
    console.error("Scheduled trend scan failed:", err.message);
  }
});

cron.schedule("*/30 * * * *", async () => {
  try {
    const result = await persistFreeSignals(pool);
    console.log("Free trend scan complete: received " + result.received + ", inserted " + result.inserted);
    const alerts = await processAlerts(pool);
    console.log("Alerts checked: " + alerts.checked + ", sent: " + alerts.sent);
  } catch (err) {
    console.error("Free trend scan failed:", err.message);
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Trend Radar API listening on :${PORT}`));
