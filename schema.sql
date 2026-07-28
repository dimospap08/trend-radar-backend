-- Trend Radar — PostgreSQL schema

CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  persona       TEXT NOT NULL DEFAULT 'creator',   -- creator | store | marketer | investor
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id  TEXT NOT NULL,
  stripe_sub_id       TEXT,
  tier                TEXT NOT NULL DEFAULT 'free',   -- free | pro | investor
  status              TEXT NOT NULL DEFAULT 'active',  -- active | past_due | canceled
  current_period_end  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Raw observations pulled from each data source, before scoring
CREATE TABLE raw_signals (
  id           BIGSERIAL PRIMARY KEY,
  source       TEXT NOT NULL,          -- tiktok | x | google_trends | dexscreener | telegram
  external_id  TEXT NOT NULL,          -- id/handle in the source platform
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,          -- Sound | Hashtag | Format | Product | Aesthetic | Coin | Narrative
  metric_value NUMERIC NOT NULL,       -- views / mentions / volume, source-specific
  observed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_raw_signals_lookup ON raw_signals (source, external_id, observed_at);

-- Computed trend, one row per detected item, updated as it evolves
CREATE TABLE trends (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  platform      TEXT NOT NULL,
  velocity_pct  NUMERIC NOT NULL,      -- % growth over trailing window
  score         INT NOT NULL,          -- 0-99 composite trend score
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_updated  TIMESTAMPTZ NOT NULL DEFAULT now(),
  spark_data    JSONB NOT NULL DEFAULT '[]'  -- recent datapoints for the sparkline
);
CREATE INDEX idx_trends_score ON trends (score DESC);
CREATE INDEX idx_trends_category ON trends (category);

CREATE TABLE watchlist (
  user_id   UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trend_id  UUID NOT NULL REFERENCES trends(id) ON DELETE CASCADE,
  added_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, trend_id)
);

CREATE TABLE alerts (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  trend_id    UUID NOT NULL REFERENCES trends(id) ON DELETE CASCADE,
  channel     TEXT NOT NULL DEFAULT 'email',  -- email | push
  sent_at     TIMESTAMPTZ
);
