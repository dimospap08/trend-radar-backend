const GOOGLE_TRENDS_URL = "https://trends.google.com/trending/rss?geo=GR";
const GDELT_URL = "https://api.gdeltproject.org/api/v2/doc/doc?query=technology&mode=timelinevol&format=json&timespan=7d";
const { scoreSeries } = require("./scoring");

function clean(value) {
  return String(value || "").replace(/<!\[CDATA\[|\]\]>/g, "").replace(/<[^>]+>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
}

function normalizeTrendName(value) {
  return String(value || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim().replace(/\s+/g, " ");
}

function parseGoogleRss(xml) {
  return [...String(xml).matchAll(/<item>([\s\S]*?)<\/item>/gi)].map((match) => {
    const body = match[1];
    const name = clean(body.match(/<title>([\s\S]*?)<\/title>/i)?.[1]);
    if (!name) return null;
    const traffic = Number(clean(body.match(/<ht:approx_traffic>([\s\S]*?)<\/ht:approx_traffic>/i)?.[1]).replace(/[^0-9]/g, "")) || 0;
    return { source: "google", external_id: "google-gr-" + normalizeTrendName(name), name, category: "Topic", platform: "Google", metric_value: traffic, source_url: GOOGLE_TRENDS_URL };
  }).filter(Boolean);
}

function parseGdelt(data) {
  const timeline = Array.isArray(data?.timeline) ? data.timeline : [];
  const points = timeline.map((point) => Number(point.value ?? point.volume ?? 0)).filter(Number.isFinite);
  if (!points.length) return [];
  const current = points.at(-1) || 0;
  const previous = points.at(-2) || 0;
  const velocity = previous > 0 ? Math.max(0, Math.round(((current - previous) / previous) * 100)) : 0;
  return [{ source: "gdelt", external_id: "gdelt-technology", name: "technology news coverage", category: "News", platform: "GDELT", metric_value: velocity, source_url: GDELT_URL }];
}

async function fetchFreeSignals(fetcher = fetch) {
  const result = { signals: [], sourceStatus: { google: "error", gdelt: "error" } };
  try {
    const response = await fetchWithTimeout(fetcher, GOOGLE_TRENDS_URL);
    if (!response.ok) throw new Error("HTTP " + response.status);
    result.signals.push(...parseGoogleRss(await response.text()));
    result.sourceStatus.google = "ok";
  } catch (error) { result.sourceStatus.googleError = error.message; }
  try {
    const response = await fetchWithTimeout(fetcher, GDELT_URL);
    if (!response.ok) throw new Error("HTTP " + response.status);
    result.signals.push(...parseGdelt(await response.json()));
    result.sourceStatus.gdelt = "ok";
  } catch (error) { result.sourceStatus.gdeltError = error.message; }
  return result;
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

async function persistFreeSignals(pool, fetcher = fetch) {
  const result = await fetchFreeSignals(fetcher);
  let inserted = 0;
  for (const signal of result.signals) {
    await pool.query("INSERT INTO raw_signals (source, external_id, name, category, metric_value) VALUES ($1, $2, $3, $4, $5)", [signal.source, signal.external_id, signal.name, signal.category, signal.metric_value]);
    const history = await pool.query(
      "SELECT metric_value, observed_at FROM raw_signals WHERE source = $1 AND external_id = $2 ORDER BY observed_at ASC",
      [signal.source, signal.external_id]
    );
    const scored = scoreSeries(history.rows.map((row) => ({ metric_value: row.metric_value, observed_at: row.observed_at })));
    const existing = await pool.query("SELECT id FROM trends WHERE name = $1 AND category = $2 AND platform = $3 LIMIT 1", [signal.name, signal.category, signal.platform]);
    let trendId;
    if (existing.rowCount) {
      trendId = existing.rows[0].id;
      await pool.query("UPDATE trends SET velocity_pct = $1, score = $2, spark_data = $3, last_updated = now(), source_url = $4 WHERE id = $5", [scored.velocity, scored.score, JSON.stringify(scored.spark), signal.source_url, trendId]);
    } else {
      const created = await pool.query("INSERT INTO trends (name, category, platform, velocity_pct, score, first_seen_at, spark_data, source_url) VALUES ($1, $2, $3, $4, $5, now(), $6, $7) RETURNING id", [signal.name, signal.category, signal.platform, scored.velocity, scored.score, JSON.stringify(scored.spark), signal.source_url]);
      trendId = created.rows[0].id;
      inserted++;
    }
    await pool.query("INSERT INTO trend_snapshots (trend_id, velocity, score) VALUES ($1, $2, $3)", [trendId, scored.velocity, scored.score]);
  }
  return { ...result, inserted, received: result.signals.length };
}

module.exports = { fetchFreeSignals, persistFreeSignals, parseGoogleRss, parseGdelt };
