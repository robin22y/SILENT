-- Enable needed extensions
-- (pgcrypto is standard in Supabase for gen_random_uuid)
create extension if not exists "pgcrypto";

-- ==========================
-- MAIN STOCKS TABLE
-- ==========================
create table if not exists stocks (
  id uuid primary key default gen_random_uuid(),
  ticker text unique not null,
  name text,
  sector text,
  industry text,
  market_cap bigint,
  price numeric,

  -- Financials
  sales_ttm bigint,
  sales_growth_yoy numeric,
  profit_margin numeric,
  price_to_sales numeric,

  -- Stage analysis
  stage integer, -- 1=Basing, 2=Advancing, 3=Topping, 4=Declining
  ma_30_week numeric,

  -- Ownership (quarterly data, delayed)
  institutional_ownership_pct numeric,
  institutional_ownership_prev_pct numeric,
  institutional_ownership_quarter text, -- e.g. 'Q4 2024'

  -- Metadata
  updated_at timestamptz default now(),
  data_quality_score integer default 100
);

-- ==========================
-- INSIDER TRANSACTIONS TABLE
-- ==========================
create table if not exists insider_transactions (
  id uuid primary key default gen_random_uuid(),
  ticker text not null,
  insider_name text,
  insider_title text,
  transaction_date date,
  transaction_type text check (transaction_type in ('buy', 'sell')),
  shares integer,
  price_per_share numeric,
  total_value numeric,
  filing_date date,

  constraint insider_transactions_ticker_fkey
    foreign key (ticker)
    references stocks(ticker)
    on delete cascade,

  -- Unique constraint for deduplication
  constraint insider_transactions_unique
    unique (ticker, insider_name, transaction_date, transaction_type, shares)
);

-- ==========================
-- INSIDER SUMMARY TABLE
-- ==========================
create table if not exists insider_summary (
  ticker text primary key,
  buys_90d integer,
  sells_90d integer,
  total_bought_value_90d numeric,
  total_sold_value_90d numeric,
  net_activity_90d numeric, -- bought - sold
  verdict text, -- 'accumulating', 'neutral', 'distributing'
  updated_at timestamptz default now(),

  constraint insider_summary_ticker_fkey
    foreign key (ticker)
    references stocks(ticker)
    on delete cascade
);

-- ==========================
-- CIK MAP TABLE (for EDGAR lookups)
-- ==========================
create table if not exists cik_map (
  ticker text primary key,
  cik text not null,
  constraint cik_map_ticker_fkey
    foreign key (ticker)
    references stocks(ticker)
    on delete cascade
);

create index if not exists idx_cik_map_cik
  on cik_map(cik);

-- ==========================
-- INDEXES
-- ==========================
create index if not exists idx_stocks_stage
  on stocks(stage);

create index if not exists idx_stocks_sector
  on stocks(sector);

create index if not exists idx_stocks_market_cap
  on stocks(market_cap desc);

create index if not exists idx_insider_ticker_date
  on insider_transactions(ticker, transaction_date desc);

