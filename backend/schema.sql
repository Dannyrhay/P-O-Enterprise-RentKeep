CREATE SCHEMA IF NOT EXISTS rentkeep;
REVOKE ALL ON SCHEMA rentkeep FROM PUBLIC;
CREATE TABLE IF NOT EXISTS rentkeep.workspace (
  singleton boolean PRIMARY KEY CHECK(singleton), revision integer NOT NULL, data jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS rentkeep.operations (
  request_id uuid PRIMARY KEY, actor text NOT NULL, payload_hash text NOT NULL,
  revision integer NOT NULL UNIQUE, action text NOT NULL, target text,
  result_id text, recorded_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS rentkeep.devices (
  endpoint text PRIMARY KEY, account text NOT NULL, subscription jsonb NOT NULL
);
CREATE TABLE IF NOT EXISTS rentkeep.deliveries (
  event_key text PRIMARY KEY, recipient text NOT NULL, tenancy_id text NOT NULL, end_date date NOT NULL,
  window_months integer NOT NULL, status text NOT NULL DEFAULT 'pending',
  attempts integer NOT NULL DEFAULT 0, next_attempt timestamptz NOT NULL DEFAULT now(),
  channel text, accepted_at timestamptz
);
