/**
 * Trend scoring service
 * -----------------------------------------------------------------------
 * Turns raw_signals (noisy, per-source measurements) into a single
 * trend score (0-99) that says "how likely is this to be a real,
 * still-accelerating trend, not a one-off spike".
 *
 * Score = weighted mix of:
 *   - velocity   : % change of metric_value over the trailing window
 *   - acceleration: is velocity itself increasing (2nd derivative)
 *   - persistence : how many consecutive windows show positive growth
 *
 * This runs on a schedule (e.g. every 15 min via a cron job / worker)
 * against freshly ingested raw_signals rows.
 */

const WINDOW_HOURS = 6;      // bucket size for velocity calc
const LOOKBACK_WINDOWS = 8;  // how many buckets back we examine (48h)

function pctChange(prev, curr) {
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

/**
 * @param {Array<{observed_at: string, metric_value: number}>} points
 *        raw_signals rows for one external_id, ordered by observed_at ASC
 * @returns {{ velocity: number, acceleration: number, persistence: number, score: number, spark: number[] }}
 */
function scoreSeries(points) {
  if (points.length < 2) {
    return { velocity: 0, acceleration: 0, persistence: 0, score: 0, spark: [] };
  }

  // bucket into WINDOW_HOURS chunks, take the latest LOOKBACK_WINDOWS buckets
  const buckets = bucketize(points, WINDOW_HOURS).slice(-LOOKBACK_WINDOWS);
  const spark = buckets.map((b) => b.value);

  const latest = buckets[buckets.length - 1]?.value ?? 0;
  const prior = buckets[buckets.length - 2]?.value ?? 0;
  const velocity = pctChange(prior, latest);

  // acceleration: velocity of the last window vs velocity of the window before it
  const prevPrior = buckets[buckets.length - 3]?.value ?? 0;
  const priorVelocity = pctChange(prevPrior, prior);
  const acceleration = velocity - priorVelocity;

  // persistence: consecutive trailing buckets with positive growth
  let persistence = 0;
  for (let i = buckets.length - 1; i > 0; i--) {
    if (buckets[i].value > buckets[i - 1].value) persistence++;
    else break;
  }

  // composite score, clamped 0-99
  const raw =
    velocity * 0.5 +
    Math.max(acceleration, 0) * 0.3 +
    persistence * 8;

  const score = Math.max(0, Math.min(99, Math.round(raw / 10)));

  return { velocity: Math.round(velocity), acceleration: Math.round(acceleration), persistence, score, spark };
}

function bucketize(points, windowHours) {
  const ms = windowHours * 60 * 60 * 1000;
  const buckets = new Map();
  for (const p of points) {
    const t = new Date(p.observed_at).getTime();
    const bucketKey = Math.floor(t / ms);
    buckets.set(bucketKey, (buckets.get(bucketKey) || 0) + Number(p.metric_value));
  }
  return [...buckets.entries()].sort((a, b) => a[0] - b[0]).map(([key, value]) => ({ key, value }));
}

/**
 * Noise filter: a candidate only gets promoted to a visible "trend"
 * if it clears these thresholds. Tune per category/persona.
 */
function passesNoiseFilter({ velocity, persistence }) {
  return velocity >= 25 && persistence >= 2;
}

module.exports = { scoreSeries, passesNoiseFilter, bucketize };
