const GOOGLE_TRENDS_URL = "https://trends.google.com/trending/rss?geo=GR";
const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc?query=technology&mode=timelinevol&format=json&timespan=7d";

function clean(value) {
  return String(value ?? "")
    .replace(/<!\[CDATA\[|\]\]>/g, "")
    .replace(/<[^>]+>/g, "")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .trim();
}

export function normalizeTrendName(value) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function parseGoogleTrendsRss(xml, country = "GR") {
  return [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match, index) => {
    const body = match[1];
    const name = clean(body.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
    if (!name) return null;
    const link = clean(body.match(/<link>([\s\S]*?)<\/link>/i)?.[1]);
    const traffic = Number(clean(body.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/i)?.[1]).replace(/[^0-9]/g, "")) || 0;
    return {
      id: "google-" + country + "-" + normalizeTrendName(name),
      name, category: "Topic", platform: "Google", country,
      velocity: Math.min(999, traffic),
      score: Math.min(99, Math.max(1, Math.round(Math.log10(traffic + 10) * 18))),
      firstSeen: 0, lastSeen: new Date().toISOString(),
      sourceUrl: link || GOOGLE_TRENDS_URL, sourceCount: 1,
      spark: [20, 24, 27, 31, 36, 42, 48, 55, 61, 68, 76, 84],
    };
  }).filter(Boolean);
}

export function parseGdeltTimeline(data) {
  const timeline = Array.isArray(data?.timeline) ? data.timeline : [];
  const values = timeline.map((point) => Number(point.value ?? point.volume ?? 0)).filter(Number.isFinite);
  if (!values.length) return [];
  const current = values.at(-1) || 0;
  const previous = values.at(-2) || 0;
  const velocity = previous > 0 ? Math.max(0, Math.min(999, Math.round(((current - previous) / previous) * 100))) : 0;
  return [{
    id: "gdelt-technology", name: "technology news coverage", category: "News",
    platform: "GDELT", country: "Global", velocity,
    score: Math.min(99, Math.max(1, Math.round(velocity / 12 + values.length * 2))),
    firstSeen: 168, lastSeen: new Date().toISOString(), sourceUrl: GDELT_URL,
    sourceCount: 1, spark: values.slice(-12).map((value) => Math.max(2, Math.round(value))),
  }];
}

export function dedupeTrends(trends) {
  const map = new Map();
  for (const trend of trends) {
    const key = normalizeTrendName(trend.name) + "|" + trend.country + "|" + trend.category;
    const old = map.get(key);
    if (!old || trend.score > old.score) map.set(key, trend);
  }
  return [...map.values()].sort((a, b) => b.score - a.score);
}

export async function fetchLiveTrends(fetcher = fetch) {
  const sourceStatus = { google: "error", gdelt: "error" };
  const trends = [];
  try {
    const response = await fetchWithTimeout(fetcher, GOOGLE_TRENDS_URL);
    if (!response.ok) throw new Error("HTTP " + response.status);
    trends.push(...parseGoogleTrendsRss(await response.text()));
    sourceStatus.google = "ok";
  } catch (error) { sourceStatus.googleError = error.message; }
  try {
    const response = await fetchWithTimeout(fetcher, GDELT_URL);
    if (!response.ok) throw new Error("HTTP " + response.status);
    trends.push(...parseGdeltTimeline(await response.json()));
    sourceStatus.gdelt = "ok";
  } catch (error) { sourceStatus.gdeltError = error.message; }
  return { updatedAt: new Date().toISOString(), sourceStatus, trends: dedupeTrends(trends) };
}

export async function fetchStoredTrends(fetcher = fetch) {
  const baseUrl = import.meta.env.VITE_SUPABASE_URL;
  const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (!baseUrl || !key) return null;
  const response = await fetcher(baseUrl + "/rest/v1/trends?select=id,name,category,platform,velocity_pct,score,first_seen_at,last_updated,spark_data,source_url&order=score.desc&limit=100", {
    headers: { apikey: key, Authorization: "Bearer " + key },
  });
  if (!response.ok) throw new Error("Supabase HTTP " + response.status);
  const rows = await response.json();
  return {
    updatedAt: new Date().toISOString(),
    sourceStatus: { database: "ok" },
    trends: rows.map((row) => ({
      ...row,
      velocity: Number(row.velocity_pct),
      spark: Array.isArray(row.spark_data) ? row.spark_data : [],
      firstSeen: Math.max(0, Math.round((Date.now() - new Date(row.first_seen_at).getTime()) / 3600000)),
      sourceUrl: row.source_url,
    })),
  };
}

async function fetchWithTimeout(fetcher, url, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetcher(url, { signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

export { GOOGLE_TRENDS_URL, GDELT_URL };
