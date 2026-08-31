const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL is missing");
  process.exit(1);
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  connectionTimeoutMillis: 10000,
  ssl: { rejectUnauthorized: false },
});

Promise.all([
  pool.query("select count(*)::int as count from trends where platform = 'Google' and category = 'Topic'"),
  pool.query("select count(*)::int as count from raw_signals where source = 'google'"),
  pool.query("select name, score from trends where platform = 'Google' and category = 'Topic' order by score desc limit 3"),
]).then(([trends, signals, top]) => {
  console.log(JSON.stringify({
    googleTrends: trends.rows[0].count,
    googleSignals: signals.rows[0].count,
    top: top.rows,
  }, null, 2));
}).catch((error) => {
  console.error("DB_VERIFY_FAILED: " + error.message);
  process.exitCode = 1;
}).finally(() => pool.end());
