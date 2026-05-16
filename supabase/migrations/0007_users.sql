-- 0007 — minimal users table.
-- Sessions are still JWT cookies (no rows here at sign-in for auth purposes);
-- this table is purely so we can SEE who has logged in and answer
-- "when did wallet X first show up / last show up" without combing through
-- listings + vaults.

create table if not exists users (
  wallet text primary key,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  -- Optional human-friendly handle the user can set later. Not enforced unique
  -- (a wallet without a handle is fine; two wallets with the same handle is a
  -- product call we'll make if we ever expose it).
  display_name text
);

create index if not exists users_last_seen_idx on users (last_seen_at desc);
