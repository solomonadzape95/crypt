-- 0008 — demo state.
-- A tiny key/value bag for the demo heartbeat endpoint that providers
-- (and us) can drop into a listing's apiUrl during prod walkthroughs.
-- We persist alive/killed in Postgres so toggles from one lambda are
-- visible to the next oracle tick from a different lambda.

create table if not exists demo_state (
  key text primary key,
  alive boolean not null default true,
  updated_at timestamptz not null default now()
);

insert into demo_state (key, alive) values ('heartbeat', true)
  on conflict (key) do nothing;
