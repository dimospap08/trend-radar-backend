const express = require("express");
const router = express.Router();
const { refreshTrends } = require("../services/geminiTrends");
const { persistFreeSignals } = require("../services/freeTrendSources");

const TIER_LIMITS = { free: 3, pro: Infinity, investor: Infinity };

router.get("/", async (req, res) => {
  const { pool } = req.app.locals;
  const persona = req.query.persona || "creator";
  const tier = req.query.tier || "free";

  const CATEGORY_BY_PERSONA = {
    creator: ["Sound", "Hashtag", "Format", "Topic", "News"],
    store: ["Product", "Aesthetic", "Hashtag", "Topic", "News"],
    marketer: ["Hashtag", "Format", "Aesthetic", "Topic", "News"],
    investor: ["Coin", "Narrative", "Topic", "News"],
  };
  const categories = CATEGORY_BY_PERSONA[persona] || CATEGORY_BY_PERSONA.creator;

  const { rows } = await pool.query(
    `SELECT id, name, category, platform, velocity_pct, score, first_seen_at, spark_data, source_url, media_url, media_type
     FROM trends
     WHERE category = ANY($1)
     ORDER BY score DESC
     LIMIT 100`,
    [categories]
  );

  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const payload = rows.map((r, idx) => ({
    ...r,
    velocity: Number(r.velocity_pct),
    spark: Array.isArray(r.spark_data) ? r.spark_data : [],
    firstSeen: Math.max(0, Math.round((Date.now() - new Date(r.first_seen_at).getTime()) / 3600000)),
    locked: idx >= limit,
  }));

  res.json({ persona, tier, updatedAt: new Date().toISOString(), sourceStatus: { database: "ok" }, trends: payload });
});

router.get("/:id/history", async (req, res) => {
  const { pool } = req.app.locals;
  const { rows } = await pool.query(
    `SELECT measured_at, velocity, score
     FROM trend_snapshots
     WHERE trend_id = $1
     ORDER BY measured_at ASC`,
    [req.params.id]
  );
  res.json({ trend_id: req.params.id, history: rows });
});

router.post("/:id/watch", async (req, res) => {
  const { pool } = req.app.locals;
  const { id } = req.params;
  const { user_id } = req.body;
  if (!user_id) return res.status(400).json({ error: "user_id required" });

  const existing = await pool.query(
    "SELECT 1 FROM watchlist WHERE user_id = $1 AND trend_id = $2",
    [user_id, id]
  );

  if (existing.rowCount) {
    await pool.query("DELETE FROM watchlist WHERE user_id = $1 AND trend_id = $2", [user_id, id]);
    return res.json({ watching: false });
  }
  await pool.query("INSERT INTO watchlist (user_id, trend_id) VALUES ($1, $2)", [user_id, id]);
  res.json({ watching: true });
});

router.post("/refresh", async (req, res) => {
  const { pool } = req.app.locals;
  try {
    const result = await refreshTrends(pool, process.env.GEMINI_API_KEY);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("Refresh failed:", err.message);
    res.status(500).json({ ok: false, error: err.message });
  }
});

router.post("/refresh-free", async (req, res) => {
  const { pool } = req.app.locals;
  try {
    const result = await persistFreeSignals(pool);
    res.json({ ok: true, ...result });
  } catch (err) {
    console.error("Free trend refresh failed:", err.message);
    res.status(502).json({ ok: false, error: err.message });
  }
});

module.exports = router;
