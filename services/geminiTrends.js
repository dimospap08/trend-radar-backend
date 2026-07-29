/**
 * Gemini trend discovery service
 * -----------------------------------------------------------------------
 * Asks Gemini to identify trends that are currently gaining momentum
 * across TikTok/social, e-commerce products, and meme coins — then
 * upserts them into the `trends` table.
 *
 * Runs on a schedule (hourly, see server.js) and can also be triggered
 * manually via POST /api/trends/refresh.
 */

const GEMINI_MODEL = "gemini-2.0-flash";
const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

const CATEGORIES = ["Sound", "Hashtag", "Format", "Product", "Aesthetic", "Coin", "Narrative"];
const PLATFORMS = ["TikTok", "Instagram Reels", "X", "YouTube Shorts", "Telegram"];

const PROMPT = `You track emerging viral trends for a "trend radar" product used by
TikTok creators, e-commerce sellers, marketers, and meme-coin traders.

List 15-20 plausible things that could be gaining fast momentum right now
(not things that are already fully mainstream/saturated) across these
categories: ${CATEGORIES.join(", ")}.

For each item return:
- name: short human-readable name
- category: one of ${CATEGORIES.join(", ")}
- platform: one of ${PLATFORMS.join(", ")}
- velocity_pct: your best estimate of % growth over the last 48 hours (integer, realistic range 20-500)
- first_seen_hours_ago: your best estimate of how many hours ago this started gaining traction (integer, 1-72)

Respond with ONLY a JSON array, no markdown, no commentary. Example shape:
[{"name":"...", "category":"Sound", "platform":"TikTok", "velocity_pct":120, "first_seen_hours_ago":18}]`;

async function fetchTrendsFromGemini(apiKey) {
  const res = await fetch(`${GEMINI_URL}?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ parts: [{ text: PROMPT }] }],
      // No Google Search grounding tool here — that requires a Google
      // Cloud billing account. This works on the free Gemini API tier.
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Gemini API error ${res.status}: ${errText}`);
  }

  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p.text).join("") || "";

  const clean = text.replace(/```json|```/g, "").trim();
  let items;
  try {
    items = JSON.parse(clean);
  } catch (e) {
    throw new Error(`Could not parse Gemini response as JSON: ${clean.slice(0, 300)}`);
  }
  if (!Array.isArray(items)) throw new Error("Gemini response was not a JSON array");
  return items;
}

function buildSpark(velocity) {
  const points = [];
  let v = Math.max(5, Math.round(velocity / 8));
  for (let i = 0; i < 12; i++) {
    v = v + Math.round((velocity / 12) * (0.6 + Math.random() * 0.6));
    points.push(Math.max(1, v));
  }
  return points;
}

async function refreshTrends(pool, apiKey) {
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const items = await fetchTrendsFromGemini(apiKey);
  let upserted = 0;

  for (const item of items) {
    if (!item?.name || !CATEGORIES.includes(item.category)) continue;
    const platform = PLATFORMS.includes(item.platform) ? item.platform : PLATFORMS[0];
    const velocity = Math.max(1, Math.min(999, Number(item.velocity_pct) || 30));
    const score = Math.max(0, Math.min(99, Math.round(velocity / 9)));
    const hoursAgo = Math.max(1, Math.min(72, Number(item.first_seen_hours_ago) || 24));
    const firstSeenAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const spark = buildSpark(velocity);

    await pool.query(
      `INSERT INTO trends (name, category, platform, velocity_pct, score, first_seen_at, spark_data)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT DO NOTHING`,
      [item.name, item.category, platform, velocity, score, firstSeenAt, JSON.stringify(spark)]
    );
    upserted++;
  }

  return { found: items.length, upserted };
}

module.exports = { refreshTrends, fetchTrendsFromGemini };
