const WINDOW_HOURS = 6;
const LOOKBACK_WINDOWS = 8;

function pctChange(prev, curr) {
  if (prev <= 0) return curr > 0 ? 100 : 0;
  return ((curr - prev) / prev) * 100;
}

function scoreSeries(points) {
  if (points.length < 2) {
    return { velocity: 0, acceleration: 0, persistence: 0, score: 0, spark: [] };
  }

  const buckets = bucketize(points, WINDOW_HOURS).slice(-LOOKBACK_WINDOWS);
  const spark = buckets.map((b) => b.value);

  const latest = buckets[buckets.length - 1]?.value ?? 0;
  const prior = buckets[buckets.length - 2]?.value ?? 0;
  const velocity = pctChange(prior, latest);

  const prevPrior = buckets[buckets.length - 3]?.value ?? 0;
  const priorVelocity = pctChange(prevPrior, prior);
  const acceleration = velocity - priorVelocity;

  let persistence = 0;
  for (let i = buckets.length - 1; i > 0; i--) {
    if (buckets[i].value > buckets[i - 1].value) persistence++;
    else break;
  }

  const raw = velocity * 0.5 + Math.max(acceleration, 0) * 0.3 + persistence * 8;
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

function passesNoiseFilter({ velocity, persistence }) {
  return velocity >= 25 && persistence >= 2;
}

module.exports = { scoreSeries, passesNoiseFilter, bucketize };
