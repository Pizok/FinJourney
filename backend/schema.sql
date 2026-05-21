create extension if not exists "pgcrypto";

create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique not null,
  avatar_class text,
  class_locked_until timestamptz,
  has_completed_setup boolean default false,
  account_day_started_at timestamptz,
  timezone text default 'Asia/Jakarta',
  created_at timestamptz default now()
);

create table player_state (
  user_id uuid primary key references profiles(id) on delete cascade,
  current_hp numeric default 100,
  total_xp numeric default 0,
  gold_coins numeric default 0,
  standby_tokens int default 7,
  defense_shield numeric default 0,
  is_taxed boolean default false,
  updated_at timestamptz default now()
);

create table wallets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  icon text,
  is_default boolean default false,
  created_at timestamptz default now()
);

create table categories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  name text not null,
  category_group text not null,
  icon text,
  is_default boolean default false,
  created_at timestamptz default now()
);

create table baselines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  category_id uuid references categories(id),
  amount numeric not null,
  effective_month int,
  effective_year int,
  created_at timestamptz default now()
);

create table transactions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id) on delete cascade,
  wallet_id uuid references wallets(id),
  target_wallet_id uuid references wallets(id),
  category_id uuid references categories(id),
  type text not null check(type in ('income','expense','transfer')),
  amount numeric not null check(amount > 0),
  note text,
  logged_at timestamptz default now(),
  is_deleted boolean default false,
create index idx_snapshot_user_date on daily_snapshots(user_id, snapshot_date desc);