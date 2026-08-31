async function sendEmailAlert({ to, trendName, score, velocity }) {
  if (!process.env.RESEND_API_KEY || !process.env.ALERT_FROM_EMAIL) {
    return { sent: false, reason: "email_not_configured" };
  }
  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      from: process.env.ALERT_FROM_EMAIL,
      to: [to],
      subject: `Trend Radar alert: ${trendName}`,
      text: `${trendName} crossed your alert threshold. Score: ${score}. Velocity: ${velocity}%.`,
    }),
  });
  if (!response.ok) throw new Error(`Email provider returned HTTP ${response.status}`);
  return { sent: true };
}

async function processAlerts(pool) {
  const { rows } = await pool.query(
    `SELECT a.id, a.user_id, a.threshold_score, a.threshold_velocity, t.name, t.score, t.velocity_pct, u.email
     FROM alerts a
     JOIN trends t ON t.id = a.trend_id
     JOIN auth.users u ON u.id = a.user_id
     WHERE a.sent_at IS NULL
       AND (a.threshold_score IS NULL OR t.score >= a.threshold_score)
       AND (a.threshold_velocity IS NULL OR t.velocity_pct >= a.threshold_velocity)
     LIMIT 100`
  );
  let sent = 0;
  for (const alert of rows) {
    const result = await sendEmailAlert({ to: alert.email, trendName: alert.name, score: alert.score, velocity: alert.velocity_pct });
    if (result.sent) {
      await pool.query("UPDATE alerts SET sent_at = now() WHERE id = $1", [alert.id]);
      sent++;
    }
  }
  return { checked: rows.length, sent };
}

module.exports = { processAlerts };
