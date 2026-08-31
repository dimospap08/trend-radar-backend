require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");
const cron = require("node-cron");

const trendsRoutes = require("./routes/trends");
const billingRoutes = require("./routes/billing");
const sportsRoutes = require("./routes/sports");
const { refreshTrends } = require("./services/geminiTrends");

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.locals.pool = pool;

app.use(cors()); // allow the frontend (different domain) to call this API

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

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Trend Radar API listening on :${PORT}`));
