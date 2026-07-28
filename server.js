require("dotenv").config();
const express = require("express");
const { Pool } = require("pg");

const trendsRoutes = require("./routes/trends");
const billingRoutes = require("./routes/billing");

const app = express();
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
app.locals.pool = pool;

// Stripe webhook needs the raw body, so mount it BEFORE express.json()
app.use("/api/billing/webhook", express.raw({ type: "application/json" }));
app.use(express.json());

app.use("/api/trends", trendsRoutes);
app.use("/api/billing", billingRoutes);

app.get("/health", (req, res) => res.json({ ok: true }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`Trend Radar API listening on :${PORT}`));
