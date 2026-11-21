BEGIN;

CREATE TABLE IF NOT EXISTS site_analytics_visitors (
  visitor_id TEXT PRIMARY KEY,
  last_seen_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  signup_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS site_analytics_visitors_last_seen_idx
  ON site_analytics_visitors (last_seen_at);

CREATE TABLE IF NOT EXISTS site_analytics_visitor_days (
  visitor_id TEXT NOT NULL REFERENCES site_analytics_visitors(visitor_id) ON DELETE CASCADE,
  visit_date DATE NOT NULL,
  PRIMARY KEY (visitor_id, visit_date)
);
CREATE INDEX IF NOT EXISTS site_analytics_visitor_days_date_idx
  ON site_analytics_visitor_days (visit_date);

CREATE TABLE IF NOT EXISTS site_analytics_daily (
  visit_date DATE PRIMARY KEY,
  visits BIGINT NOT NULL DEFAULT 0 CHECK (visits >= 0)
);

INSERT INTO schema_migrations (version)
VALUES ('019_site_analytics')
ON CONFLICT (version) DO NOTHING;

COMMIT;
