require("dotenv").config({ path: ".env.local" });
require("dotenv").config();
const express = require("express");
const cors = require("cors");
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

const allowedOrigins = new Set([
  "https://trendradarpro.com",
  "https://www.trendradarpro.com",
  ...(process.env.ALLOWED_ORIGINS || "").split(",").map((origin) => origin.trim()).filter(Boolean),
]);

app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  next();
});

app.use(cors({
  origin(origin, callback) {
    if (!origin || allowedOrigins.has(origin) || process.env.NODE_ENV !== "production") return callback(null, true);
    return callback(new Error("Origin is not allowed"));
  },
  methods: ["GET", "POST", "DELETE"],
  allowedHeaders: ["Content-Type", "Authorization", "Stripe-Signature"],
}));

async function ensureTrendSchema() {
  await pool.query("ALTER TABLE trends ADD COLUMN IF NOT EXISTS description TEXT");
  await pool.query("ALTER TABLE trends ADD COLUMN IF NOT EXISTS source_checked_at TIMESTAMPTZ");
}

ensureTrendSchema().catch((error) => console.error("Trend schema check failed:", error.message));

app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

app.use("/api/trends", trendsRoutes);
app.use("/api/billing", billingRoutes);
app.use("/api/sports", sportsRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));

cron.schedule("0 * * * *", async () => {
  const hasVertexCredentials = Boolean(process.env.GOOGLE_CREDENTIALS_JSON && process.env.GOOGLE_CLOUD_PROJECT);
  if (!hasVertexCredentials) {
    console.log("Skipping scheduled trend scan: Google Vertex credentials are not set");
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
