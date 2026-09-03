/**
 * Gemini trend discovery service
 * -----------------------------------------------------------------------
 * Uses Vertex AI (service account auth) with Google Search grounding to
 * find real-time trending topics — then upserts them into the `trends` table.
 */
const fs = require("fs");
const os = require("os");
const path = require("path");
const { GoogleGenAI } = require("@google/genai");

// Write the service account JSON (from env var) to a temp file once,
// and point Google's auth library at it.
if (process.env.GOOGLE_CREDENTIALS_JSON && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
  const credPath = path.join(os.tmpdir(), "gcp-key.json");
  fs.writeFileSync(credPath, process.env.GOOGLE_CREDENTIALS_JSON);
  process.env.GOOGLE_APPLICATION_CREDENTIALS = credPath;
}

const GEMINI_MODEL = "gemini-2.5-flash";
const CATEGORIES = ["Sound", "Hashtag", "Format", "Product", "Aesthetic", "Narrative", "CryptoCoin", "MemeCoin", "CopyTrader", "GlobalMarket"];
const PLATFORMS = ["TikTok", "Instagram Reels", "X", "YouTube Shorts", "Telegram"];
const SOURCE_REQUIRED_CATEGORIES = new Set(["Product", "CryptoCoin", "MemeCoin", "CopyTrader", "GlobalMarket"]);
const PROMPT = `You track emerging viral trends for a "trend radar" product used by
TikTok creators, e-commerce sellers, marketers, crypto investors, meme-coin traders, and crypto builders.
Use Google Search to find things that are ACTUALLY gaining fast momentum
right now (not things that are already fully mainstream/saturated) across
these categories: ${CATEGORIES.join(", ")}. Keep CryptoCoin, MemeCoin, and CopyTrader strictly separate: each item belongs to only one of those categories and each must have its own distinct source_url.
Return 12-18 items for every category whenever reliable current results exist.
A folder should never be filled with invented data just
to reach the target: if a result cannot be verified, return fewer for that category.
Do not invent names: every item must be a real entity found in the search results.
For MemeCoin use a real token/project that currently exists; for CopyTrader use
a real, currently active public trader profile on a copy-trading platform (such
as eToro, Binance, Bybit, Bitget or a comparable service), including performance,
drawdown and follower metrics when published; for Product use a real product
listing. If a category has no reliable result, return fewer
items for that category rather than fabricating one. For each item return:
- name: short human-readable name
- category: one of ${CATEGORIES.join(", ")}
- platform: one of ${PLATFORMS.join(", ")}
- velocity_pct: your best estimate of % growth over the last 48 hours (integer, realistic range 20-500)
- first_seen_hours_ago: your best estimate of how many hours ago this started gaining traction (integer, 1-72)
- source_url: the exact public webpage found by Google Search that supports this trend; use null if unavailable
- for Product items, prefer the exact public listing on Amazon, AliExpress, or the marketplace where the product was found
- media_url: a direct public image/video URL only if reliably available; otherwise null, never invent URLs
- media_type: "image" or "video"
- description: one short sentence explaining what this is and why it matters now
- source_url is mandatory for Product, CryptoCoin, MemeCoin, CopyTrader and GlobalMarket; skip an item in those categories when no reliable source was found
- media_url is optional and must never be invented
Respond with ONLY a JSON array, no markdown, no commentary. Example shape:
[{"name":"...", "category":"Sound", "platform":"TikTok", "velocity_pct":120, "first_seen_hours_ago":18, "source_url":"https://...", "media_url":"https://...", "media_type":"image", "description":"..."}]`;

async function fetchTrendsFromGemini() {
  const ai = new GoogleGenAI({
    vertexai: true,
    project: process.env.GOOGLE_CLOUD_PROJECT,
    location: process.env.GOOGLE_CLOUD_LOCATION || "us-central1",
  });
  const response = await ai.models.generateContent({
    model: GEMINI_MODEL,
    contents: PROMPT,
    config: {
      tools: [{ googleSearch: {} }],
    },
  });
  const text = response.text || "";
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

function safeUrl(value) {
  try {
    const url = new URL(String(value || ""));
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch (_) { return null; }
}

// Note: the second `apiKey` argument is accepted but ignored now that
// authentication happens via the GOOGLE_CREDENTIALS_JSON service account.
async function refreshTrends(pool, _apiKey) {
  const items = await fetchTrendsFromGemini();
  let upserted = 0;
  for (const item of items) {
    if (!item?.name || !CATEGORIES.includes(item.category)) continue;
    const sourceUrl = safeUrl(item.source_url);
    if (SOURCE_REQUIRED_CATEGORIES.has(item.category) && !sourceUrl) continue;
    const platform = PLATFORMS.includes(item.platform) ? item.platform : PLATFORMS[0];
    const velocity = Math.max(1, Math.min(999, Number(item.velocity_pct) || 30));
    const score = Math.max(0, Math.min(99, Math.round(velocity / 9)));
    const hoursAgo = Math.max(1, Math.min(72, Number(item.first_seen_hours_ago) || 24));
    const firstSeenAt = new Date(Date.now() - hoursAgo * 60 * 60 * 1000);
    const spark = buildSpark(velocity);
    const mediaUrl = safeUrl(item.media_url);
    const mediaType = item.media_type === "video" ? "video" : "image";
    const description = String(item.description || "").trim().slice(0, 280) || null;
    await pool.query(
      `INSERT INTO trends (name, category, platform, velocity_pct, score, first_seen_at, spark_data, source_url, media_url, media_type, description, source_checked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, now())
       ON CONFLICT DO NOTHING`,
      [item.name, item.category, platform, velocity, score, firstSeenAt, JSON.stringify(spark), sourceUrl, mediaUrl, mediaType, description]
    );
    upserted++;
  }
  return { found: items.length, upserted };
}

module.exports = { refreshTrends, fetchTrendsFromGemini };
