const express = require("express");
const router = express.Router();
const { refreshTrends } = require("../services/geminiTrends");

const TIER_LIMITS = { free: 3, pro: Infinity, investor: Infinity };

router.get("/", async (req, res) => {
  const { pool } = req.app.locals;
  const persona = req.query.persona || "creator";
  const tier = req.query.tier || "free";

  const CATEGORY_BY_PERSONA = {
    creator: ["Sound", "Hashtag", "Format"],
    store: ["Product", "Aesthetic", "Hashtag"],
    marketer: ["Hashtag", "Format", "Aesthetic"],
    investor: ["Coin", "Narrative"],
  };
  const categories = CATEGORY_BY_PERSONA[persona] || CATEGORY_BY_PERSONA.creator;

  const { rows } = await pool.query(
    `SELECT id, name, category, platform, velocity_pct, score, first_seen_at, spark_data
     FROM trends
     WHERE category = ANY($1)
     ORDER BY score DESC
     LIMIT 100`,
    [categories]
  );

  const limit = TIER_LIMITS[tier] ?? TIER_LIMITS.free;
  const payload = rows.map((r, idx) => ({ ...r, locked: idx >= limit }));

  res.json({ persona, tier, trends: payload });
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

module.exports = router;
