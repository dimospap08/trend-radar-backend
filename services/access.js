const SIGNAL_TIERS = new Set(["investor", "signal", "signalplus"]);

function normalizeTier(value) {
  return String(value || "").trim().toLowerCase().replace(/[+\s]/g, "");
}

async function requireSignalAccess(req, res, next) {
  const { pool } = req.app.locals;
  try {
    const result = await pool.query(
      "SELECT tier FROM subscriptions WHERE user_id = $1 AND status = 'active' ORDER BY created_at DESC LIMIT 1",
      [req.user.id]
    );
    if (!SIGNAL_TIERS.has(normalizeTier(result.rows[0]?.tier))) {
      return res.status(403).json({ error: "Signal+ subscription required" });
    }
    next();
  } catch (error) {
    next(error);
  }
}

function requireAdmin(req, res, next) {
  const adminIds = new Set(String(process.env.ADMIN_USER_IDS || "").split(",").map((id) => id.trim()).filter(Boolean));
  if (!adminIds.has(req.user.id)) return res.status(403).json({ error: "Administrator access required" });
  next();
}

module.exports = { normalizeTier, requireSignalAccess, requireAdmin };
