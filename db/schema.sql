CREATE TABLE users (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  persona       TEXT NOT NULL DEFAULT 'creator',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE subscriptions (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id             UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  stripe_customer_id  TEXT NOT NULL,
  stripe_sub_id       TEXT,
  tier                TEXT NOT NULL DEFAULT 'free',
  status              TEXT NOT NULL DEFAULT 'active',
  current_period_end  TIMESTAMPTZ,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE raw_signals (
  id           BIGSERIAL PRIMARY KEY,
  source       TEXT NOT NULL,
  external_id  TEXT NOT NULL,
  name         TEXT NOT NULL,
  category     TEXT NOT NULL,
  metric_value NUMERIC NOT NULL,
  observed_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_raw_signals_lookup ON raw_signals (source, external_id, observed_at);

CREATE TABLE trends (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name          TEXT NOT NULL,
  category      TEXT NOT NULL,
  platform      TEXT NOT NULL,
  velocity_pct  NUMERIC NOT NULL,
  score         INT NOT NULL,
  first_seen_at TIMESTAMPTZ NOT NULL,
  last_updated  TIMESTAMPTZ NOT NULL DEFAULT now(),
  spark_data    JSONB NOT NULL DEFAULT '[]',
  source_url    TEXT,
  media_url     TEXT,
  media_type    TEXT NOT NULL DEFAULT 'image'
);
ALTER TABLE trends ADD COLUMN IF NOT EXISTS source_url TEXT;
ALTER TABLE trends ADD COLUMN IF NOT EXISTS media_url TEXT;
ALTER TABLE trends ADD COLUMN IF NOT EXISTS media_type TEXT NOT NULL DEFAULT 'image';
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
  channel     TEXT NOT NULL DEFAULT 'email',
  sent_at     TIMESTAMPTZ
);
