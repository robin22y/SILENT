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

-- ==========================
-- TICKERS TABLE (tracked stocks)
-- ==========================
create table if not exists tickers (
  ticker text primary key,
  created_at timestamptz default now()
);

-- ==========================
-- TRADING JOURNAL TABLE
-- ==========================
create table if not exists trading_journal (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  direction text check (direction in ('long', 'short', '')),
  entry_price numeric,
  exit_price numeric,
  position_size numeric,
  reason text,
  emotion text,
  notes text,
  screenshot_url text,
  pnl numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_trading_journal_user_id
  on trading_journal(user_id);

create index if not exists idx_trading_journal_created_at
  on trading_journal(created_at desc);

-- ==========================
-- USER SUBSCRIPTION TABLE
-- ==========================
create table if not exists user_subscription (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free', 'tier50', 'tier100')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_user_subscription_user_id
  on user_subscription(user_id);

-- ==========================
-- D.Y. RESEARCH TABLES
-- ==========================

-- Research questions (pre-defined)
create table if not exists dy_questions (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  question text not null,
  guidance text,
  data_sources text, -- JSON array of URLs/hints
  is_dynamic boolean default false,
  is_active boolean default true,
  sort_order integer default 0,
  created_at timestamptz default now()
);

create index if not exists idx_dy_questions_category
  on dy_questions(category);

create index if not exists idx_dy_questions_active
  on dy_questions(is_active, sort_order);

-- User answers to questions
create table if not exists dy_answers (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  question_id uuid not null references dy_questions(id) on delete cascade,
  answer_text text,
  completed boolean default false,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint dy_answers_unique unique (user_id, ticker, question_id)
);

create index if not exists idx_dy_answers_user_ticker
  on dy_answers(user_id, ticker);

-- User decisions (BUY/HOLD/SELL)
create table if not exists dy_decisions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  decision text not null check (decision in ('BUY', 'HOLD', 'SELL')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint dy_decisions_unique unique (user_id, ticker)
);

create index if not exists idx_dy_decisions_user_ticker
  on dy_decisions(user_id, ticker);

-- Additional metadata (chart links, notes)
create table if not exists dy_meta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  ticker text not null,
  chart_link text,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  constraint dy_meta_unique unique (user_id, ticker)
);

create index if not exists idx_dy_meta_user_ticker
  on dy_meta(user_id, ticker);

-- ==========================
-- ADMIN USERS TABLE
-- ==========================
create table if not exists admin_users (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  email text not null,
  is_active boolean default true,
  created_at timestamptz default now()
);

create index if not exists idx_admin_users_user_id
  on admin_users(user_id);

create index if not exists idx_admin_users_email
  on admin_users(email);

