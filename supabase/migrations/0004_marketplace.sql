-- Open marketplace pivot.
-- Listings are providers' reusable offerings. Each subscription becomes a vault
-- row that snapshots the listing's terms at subscribe-time, so the breach
-- dashboard still renders correctly if the listing is later edited or paused.

create table if not exists public.listings (
  id                       uuid primary key default gen_random_uuid(),
  provider_wallet          text not null,
  provider_payout_target   text not null,
  title                    text not null,
  description              text,
  api_url                  text not null,
  oracle_period_sec        int not null default 60,
  failure_threshold        int not null default 3,
  sla_target_pct           numeric(5,2) not null default 99.90,
  guarantee_usdc           numeric(10,2) not null,
  subscription_fee_usdc    numeric(10,2) not null,
  boundless_url            text,
  active                   boolean not null default true,
  created_at               timestamptz not null default now()
);

create index if not exists listings_provider_idx on public.listings (provider_wallet);
create index if not exists listings_active_idx   on public.listings (active);

-- Per-subscription additions to vaults.
alter table public.vaults
  add column if not exists listing_id                uuid references public.listings(id),
  add column if not exists subscriber_payout_target  text,
  add column if not exists provider_payout_target    text,
  add column if not exists settle_error              text;

-- Realtime publication for marketplace browsing.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'listings'
  ) then
    execute 'alter publication supabase_realtime add table public.listings';
  end if;
end$$;
