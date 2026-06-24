-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.journey_profiles (
  id uuid NOT NULL,
  username text NOT NULL UNIQUE,
  timezone text DEFAULT 'Asia/Jakarta'::text,
  last_timezone_change_at timestamp with time zone,
  active_path USER-DEFINED DEFAULT 'UNASSIGNED'::player_path,
  path_cooldown_until timestamp with time zone,
  has_completed_setup boolean DEFAULT false,
  feature_unlocks jsonb DEFAULT '{}'::jsonb,
  expected_monthly_income numeric DEFAULT 0,
  monthly_savings_target numeric DEFAULT 0,
  primary_payday integer CHECK (primary_payday >= 1 AND primary_payday <= 31),
  app_preferences jsonb DEFAULT '{"theme": "system", "privacy_mode": false, "reduced_motion": false}'::jsonb,
  notification_settings jsonb DEFAULT '{"hazard_alerts": true, "daily_reminder": true, "achievement_notifications": true}'::jsonb,
  current_hp numeric DEFAULT 100 CHECK (current_hp >= 0::numeric AND current_hp <= 100::numeric),
  total_xp numeric DEFAULT 0,
  current_level integer DEFAULT 1,
  vitality USER-DEFINED DEFAULT 'NORMAL'::vitality_state,
  current_streak integer DEFAULT 0,
  longest_streak integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  last_username_change_at timestamp with time zone,
  is_dev_account boolean NOT NULL DEFAULT false,
  CONSTRAINT journey_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT journey_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['cash'::text, 'bank'::text, 'credit'::text, 'savings'::text, 'investment'::text])),
  balance numeric DEFAULT 0,
  last_reconciled_at timestamp with time zone DEFAULT now(),
  color_token text,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT wallets_pkey PRIMARY KEY (id),
  CONSTRAINT wallets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id)
);
CREATE TABLE public.categories (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  category_group USER-DEFINED NOT NULL,
  monthly_limit numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT categories_pkey PRIMARY KEY (id),
  CONSTRAINT categories_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id)
);
CREATE TABLE public.transactions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  primary_wallet_id uuid,
  source_wallet_id uuid,
  destination_wallet_id uuid,
  transfer_group_id uuid,
  category_id uuid,
  type USER-DEFINED NOT NULL,
  amount numeric NOT NULL CHECK (amount > 0::numeric),
  payment_method text NOT NULL CHECK (payment_method = ANY (ARRAY['cash'::text, 'debit_card'::text, 'credit_card'::text, 'e_wallet'::text, 'other'::text, 'transfer'::text])),
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'deleted'::text])),
  note text,
  transaction_date date NOT NULL,
  logged_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id),
  CONSTRAINT transactions_primary_wallet_id_fkey FOREIGN KEY (primary_wallet_id) REFERENCES public.wallets(id),
  CONSTRAINT transactions_source_wallet_id_fkey FOREIGN KEY (source_wallet_id) REFERENCES public.wallets(id),
  CONSTRAINT transactions_destination_wallet_id_fkey FOREIGN KEY (destination_wallet_id) REFERENCES public.wallets(id),
  CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id)
);
CREATE TABLE public.fixed_expenses (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  amount numeric NOT NULL,
  recurrence_type USER-DEFINED NOT NULL,
  recurrence_value text,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT fixed_expenses_pkey PRIMARY KEY (id),
  CONSTRAINT fixed_expenses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id)
);
CREATE TABLE public.loans (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  status USER-DEFINED DEFAULT 'ACTIVE'::loan_status,
  total_amount numeric NOT NULL,
  paid_amount numeric DEFAULT 0,
  next_due_date date,
  monthly_installment numeric DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT loans_pkey PRIMARY KEY (id),
  CONSTRAINT loans_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id)
);
CREATE TABLE public.savings_targets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  target_amount numeric NOT NULL,
  current_amount numeric DEFAULT 0,
  priority integer DEFAULT 0,
  deadline date NOT NULL,
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'completed'::text, 'archived'::text])),
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  CONSTRAINT savings_targets_pkey PRIMARY KEY (id),
  CONSTRAINT savings_targets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id)
);
CREATE TABLE public.journey_daily_survival (
  user_id uuid NOT NULL,
  tracking_date date NOT NULL,
  status USER-DEFINED DEFAULT 'PENDING'::daily_survival_status,
  expense_xp_claimed boolean DEFAULT false,
  income_xp_claimed boolean DEFAULT false,
  zero_spend_xp_claimed boolean DEFAULT false,
  last_evaluated_at timestamp with time zone,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT journey_daily_survival_pkey PRIMARY KEY (user_id, tracking_date),
  CONSTRAINT journey_daily_survival_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id)
);
CREATE TABLE public.journey_inventory (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  type USER-DEFINED NOT NULL,
  status USER-DEFINED DEFAULT 'AVAILABLE'::item_status,
  created_at timestamp with time zone DEFAULT now(),
  activated_at timestamp with time zone,
  expires_at timestamp with time zone,
  source_event_id uuid,
  CONSTRAINT journey_inventory_pkey PRIMARY KEY (id),
  CONSTRAINT journey_inventory_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id),
  CONSTRAINT fk_inventory_event FOREIGN KEY (source_event_id) REFERENCES public.journey_events(id)
);
CREATE TABLE public.journey_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  idempotency_key text NOT NULL UNIQUE,
  user_id uuid,
  event_type text NOT NULL,
  event_version integer DEFAULT 1,
  source USER-DEFINED NOT NULL,
  severity USER-DEFINED NOT NULL,
  status USER-DEFINED DEFAULT 'CREATED'::event_status,
  xp_delta integer DEFAULT 0,
  hp_delta integer DEFAULT 0,
  shield_delta integer DEFAULT 0,
  payload jsonb DEFAULT '{}'::jsonb,
  error_log text,
  created_at timestamp with time zone DEFAULT now(),
  processed_at timestamp with time zone,
  published_at timestamp with time zone,
  retry_count integer DEFAULT 0,
  CONSTRAINT journey_events_pkey PRIMARY KEY (id),
  CONSTRAINT journey_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id)
);
CREATE TABLE public.journey_challenges (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  template_id text NOT NULL,
  status USER-DEFINED DEFAULT 'PREPARING'::challenge_status,
  started_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  completed_at timestamp with time zone,
  progress_data jsonb DEFAULT '{}'::jsonb,
  rewards_claimed boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT journey_challenges_pkey PRIMARY KEY (id),
  CONSTRAINT journey_challenges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id)
);
CREATE TABLE public.journey_regions (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  region_id text NOT NULL,
  status USER-DEFINED DEFAULT 'CURRENT'::region_status,
  started_at timestamp with time zone NOT NULL,
  ends_at timestamp with time zone NOT NULL,
  shifted_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT journey_regions_pkey PRIMARY KEY (id),
  CONSTRAINT journey_regions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id)
);
CREATE TABLE public.journey_notifications (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  source_event_id uuid,
  category USER-DEFINED NOT NULL,
  severity USER-DEFINED NOT NULL,
  status USER-DEFINED DEFAULT 'UNREAD'::notification_status,
  title text NOT NULL,
  message text NOT NULL,
  action_type text,
  action_payload jsonb,
  created_at timestamp with time zone DEFAULT now(),
  read_at timestamp with time zone,
  archived_at timestamp with time zone,
  CONSTRAINT journey_notifications_pkey PRIMARY KEY (id),
  CONSTRAINT journey_notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id),
  CONSTRAINT journey_notifications_source_event_id_fkey FOREIGN KEY (source_event_id) REFERENCES public.journey_events(id)
);