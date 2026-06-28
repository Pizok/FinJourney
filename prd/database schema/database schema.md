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
  avatar_key character varying NOT NULL DEFAULT 'Roan'::character varying,
  gold_coins double precision DEFAULT 0.0,
  defense_shield double precision DEFAULT 0.0,
  standby_tokens integer DEFAULT 7,
  CONSTRAINT journey_profiles_pkey PRIMARY KEY (id),
  CONSTRAINT journey_profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id)
);
CREATE TABLE public.wallets (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid,
  name text NOT NULL,
  type text NOT NULL CHECK (type = ANY (ARRAY['cash'::text, 'bank'::text, 'credit'::text, 'savings'::text, 'investment'::text, 'e_wallet'::text])),
  balance numeric DEFAULT 0,
  last_reconciled_at timestamp with time zone DEFAULT now(),
  color_token text,
  created_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  visible_category_ids ARRAY DEFAULT '{}'::uuid[],
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
  payment_method text NOT NULL CHECK (payment_method = ANY (ARRAY['cash'::text, 'debit_card'::text, 'credit_card'::text, 'e_wallet'::text, 'other'::text, 'transfer'::text, 'qr_code'::text])),
  status text DEFAULT 'active'::text CHECK (status = ANY (ARRAY['active'::text, 'deleted'::text])),
  note text,
  transaction_date date NOT NULL,
  logged_at timestamp with time zone DEFAULT now(),
  deleted_at timestamp with time zone,
  savings_target_id uuid,
  CONSTRAINT transactions_pkey PRIMARY KEY (id),
  CONSTRAINT transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id),
  CONSTRAINT transactions_primary_wallet_id_fkey FOREIGN KEY (primary_wallet_id) REFERENCES public.wallets(id),
  CONSTRAINT transactions_source_wallet_id_fkey FOREIGN KEY (source_wallet_id) REFERENCES public.wallets(id),
  CONSTRAINT transactions_destination_wallet_id_fkey FOREIGN KEY (destination_wallet_id) REFERENCES public.wallets(id),
  CONSTRAINT transactions_category_id_fkey FOREIGN KEY (category_id) REFERENCES public.categories(id),
  CONSTRAINT transactions_savings_target_id_fkey FOREIGN KEY (savings_target_id) REFERENCES public.savings_targets(id)
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
  last_payment_date date,
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
  monthly_contribution_target numeric DEFAULT 0,
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
CREATE TABLE public.income_streams (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  amount numeric NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT timezone('utc'::text, now()),
  deleted_at timestamp with time zone,
  CONSTRAINT income_streams_pkey PRIMARY KEY (id),
  CONSTRAINT income_streams_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id)
);
CREATE TABLE public.system_flags (
  key text NOT NULL,
  value jsonb NOT NULL,
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT system_flags_pkey PRIMARY KEY (key)
);
CREATE TABLE public.journey_region_nodes (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  node_id text NOT NULL,
  region_id text NOT NULL,
  status USER-DEFINED NOT NULL DEFAULT 'LOCKED'::region_status,
  unlocked_at timestamp with time zone,
  shifted_at timestamp with time zone,
  CONSTRAINT journey_region_nodes_pkey PRIMARY KEY (id),
  CONSTRAINT journey_region_nodes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id)
);
CREATE TABLE public.journey_journal (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  message text NOT NULL,
  severity character varying DEFAULT 'info'::character varying,
  source_event_id uuid,
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT journey_journal_pkey PRIMARY KEY (id),
  CONSTRAINT journey_journal_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id),
  CONSTRAINT journey_journal_source_event_id_fkey FOREIGN KEY (source_event_id) REFERENCES public.journey_events(id)
);
CREATE TABLE public.journey_unlock_events (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  level_reached integer NOT NULL,
  feature_key text NOT NULL,
  shown boolean NOT NULL DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()),
  CONSTRAINT journey_unlock_events_pkey PRIMARY KEY (id),
  CONSTRAINT journey_unlock_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id)
);
CREATE TABLE public.journey_quarterly_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quarter integer NOT NULL,
  year integer NOT NULL,
  quarter_start date NOT NULL,
  quarter_end date NOT NULL,
  is_partial boolean NOT NULL DEFAULT false,
  computed_at timestamp with time zone DEFAULT now(),
  longest_streak integer NOT NULL DEFAULT 0,
  zero_spend_days integer NOT NULL DEFAULT 0,
  total_income numeric NOT NULL DEFAULT 0,
  total_expenses numeric NOT NULL DEFAULT 0,
  net_change numeric NOT NULL DEFAULT 0,
  starting_wallet_balance numeric NOT NULL DEFAULT 0,
  ending_wallet_balance numeric NOT NULL DEFAULT 0,
  challenges_summary jsonb DEFAULT '[]'::jsonb,
  spending_by_category jsonb DEFAULT '[]'::jsonb,
  wallet_breakdown jsonb DEFAULT '[]'::jsonb,
  CONSTRAINT journey_quarterly_reports_pkey PRIMARY KEY (id),
  CONSTRAINT journey_quarterly_reports_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id)
);
CREATE TABLE public.journey_passport_stamps (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  stamp_key character varying NOT NULL,
  unlocked_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT journey_passport_stamps_pkey PRIMARY KEY (id),
  CONSTRAINT journey_passport_stamps_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id)
);


| table_name              | column_name             | ordinal_position | is_nullable | column_default                                                                              | resolved_type            | enum_values                                            |
| ----------------------- | ----------------------- | ---------------- | ----------- | ------------------------------------------------------------------------------------------- | ------------------------ | ------------------------------------------------------ |
| categories              | id                      | 1                | NO          | gen_random_uuid()                                                                           | uuid                     | null                                                   |
| categories              | user_id                 | 2                | YES         | null                                                                                        | uuid                     | null                                                   |
| categories              | name                    | 3                | NO          | null                                                                                        | text                     | null                                                   |
| categories              | category_group          | 4                | NO          | null                                                                                        | category_group           | {income,expense}                                       |
| categories              | monthly_limit           | 5                | YES         | 0                                                                                           | numeric                  | null                                                   |
| categories              | created_at              | 6                | YES         | now()                                                                                       | timestamp with time zone | null                                                   |
| categories              | deleted_at              | 7                | YES         | null                                                                                        | timestamp with time zone | null                                                   |
| fixed_expenses          | id                      | 1                | NO          | gen_random_uuid()                                                                           | uuid                     | null                                                   |
| fixed_expenses          | user_id                 | 2                | YES         | null                                                                                        | uuid                     | null                                                   |
| fixed_expenses          | name                    | 3                | NO          | null                                                                                        | text                     | null                                                   |
| fixed_expenses          | amount                  | 4                | NO          | null                                                                                        | numeric                  | null                                                   |
| fixed_expenses          | recurrence_type         | 5                | NO          | null                                                                                        | recurrence_type          | {daily,weekly,monthly,yearly}                          |
| fixed_expenses          | recurrence_value        | 6                | YES         | null                                                                                        | text                     | null                                                   |
| fixed_expenses          | created_at              | 7                | YES         | now()                                                                                       | timestamp with time zone | null                                                   |
| income_streams          | id                      | 1                | NO          | gen_random_uuid()                                                                           | uuid                     | null                                                   |
| income_streams          | user_id                 | 2                | NO          | null                                                                                        | uuid                     | null                                                   |
| income_streams          | name                    | 3                | NO          | null                                                                                        | text                     | null                                                   |
| income_streams          | amount                  | 4                | NO          | null                                                                                        | numeric                  | null                                                   |
| income_streams          | created_at              | 5                | NO          | timezone('utc'::text, now())                                                                | timestamp with time zone | null                                                   |
| income_streams          | deleted_at              | 6                | YES         | null                                                                                        | timestamp with time zone | null                                                   |
| journey_challenges      | id                      | 1                | NO          | gen_random_uuid()                                                                           | uuid                     | null                                                   |
| journey_challenges      | user_id                 | 2                | YES         | null                                                                                        | uuid                     | null                                                   |
| journey_challenges      | template_id             | 3                | NO          | null                                                                                        | text                     | null                                                   |
| journey_challenges      | status                  | 4                | YES         | 'PREPARING'::challenge_status                                                               | challenge_status         | {PREPARING,ACTIVE,COMPLETED,FAILED,ARCHIVED}           |
| journey_challenges      | started_at              | 5                | NO          | null                                                                                        | timestamp with time zone | null                                                   |
| journey_challenges      | ends_at                 | 6                | NO          | null                                                                                        | timestamp with time zone | null                                                   |
| journey_challenges      | completed_at            | 7                | YES         | null                                                                                        | timestamp with time zone | null                                                   |
| journey_challenges      | progress_data           | 8                | YES         | '{}'::jsonb                                                                                 | jsonb                    | null                                                   |
| journey_challenges      | rewards_claimed         | 9                | YES         | false                                                                                       | boolean                  | null                                                   |
| journey_challenges      | created_at              | 10               | YES         | now()                                                                                       | timestamp with time zone | null                                                   |
| journey_daily_survival  | user_id                 | 1                | NO          | null                                                                                        | uuid                     | null                                                   |
| journey_daily_survival  | tracking_date           | 2                | NO          | null                                                                                        | date                     | null                                                   |
| journey_daily_survival  | status                  | 3                | YES         | 'PENDING'::daily_survival_status                                                            | daily_survival_status    | {PENDING,SAFE_LOGGED,SAFE_CLAIMED}                     |
| journey_daily_survival  | expense_xp_claimed      | 4                | YES         | false                                                                                       | boolean                  | null                                                   |
| journey_daily_survival  | income_xp_claimed       | 5                | YES         | false                                                                                       | boolean                  | null                                                   |
| journey_daily_survival  | zero_spend_xp_claimed   | 6                | YES         | false                                                                                       | boolean                  | null                                                   |
| journey_daily_survival  | last_evaluated_at       | 7                | YES         | null                                                                                        | timestamp with time zone | null                                                   |
| journey_daily_survival  | updated_at              | 8                | YES         | now()                                                                                       | timestamp with time zone | null                                                   |
| journey_events          | id                      | 1                | NO          | gen_random_uuid()                                                                           | uuid                     | null                                                   |
| journey_events          | idempotency_key         | 2                | NO          | null                                                                                        | text                     | null                                                   |
| journey_events          | user_id                 | 3                | YES         | null                                                                                        | uuid                     | null                                                   |
| journey_events          | event_type              | 4                | NO          | null                                                                                        | text                     | null                                                   |
| journey_events          | event_version           | 5                | YES         | 1                                                                                           | integer                  | null                                                   |
| journey_events          | source                  | 6                | NO          | null                                                                                        | event_source             | {USER,SYSTEM,ENGINE}                                   |
| journey_events          | severity                | 7                | NO          | null                                                                                        | event_severity           | {INFO,SUCCESS,WARNING,DANGER}                          |
| journey_events          | status                  | 8                | YES         | 'CREATED'::event_status                                                                     | event_status             | {CREATED,PROCESSED,PUBLISHED,FAILED}                   |
| journey_events          | xp_delta                | 9                | YES         | 0                                                                                           | integer                  | null                                                   |
| journey_events          | hp_delta                | 10               | YES         | 0                                                                                           | integer                  | null                                                   |
| journey_events          | shield_delta            | 11               | YES         | 0                                                                                           | integer                  | null                                                   |
| journey_events          | payload                 | 12               | YES         | '{}'::jsonb                                                                                 | jsonb                    | null                                                   |
| journey_events          | error_log               | 13               | YES         | null                                                                                        | text                     | null                                                   |
| journey_events          | created_at              | 14               | YES         | now()                                                                                       | timestamp with time zone | null                                                   |
| journey_events          | processed_at            | 15               | YES         | null                                                                                        | timestamp with time zone | null                                                   |
| journey_events          | published_at            | 16               | YES         | null                                                                                        | timestamp with time zone | null                                                   |
| journey_events          | retry_count             | 17               | YES         | 0                                                                                           | integer                  | null                                                   |
| journey_inventory       | id                      | 1                | NO          | gen_random_uuid()                                                                           | uuid                     | null                                                   |
| journey_inventory       | user_id                 | 2                | YES         | null                                                                                        | uuid                     | null                                                   |
| journey_inventory       | type                    | 3                | NO          | null                                                                                        | item_type                | {DEFENSE_SHIELD,STANDBY_TOKEN,CONSUMABLE}              |
| journey_inventory       | status                  | 4                | YES         | 'AVAILABLE'::item_status                                                                    | item_status              | {AVAILABLE,ACTIVE,USED,DESTROYED,EXPIRED}              |
| journey_inventory       | created_at              | 5                | YES         | now()                                                                                       | timestamp with time zone | null                                                   |
| journey_inventory       | activated_at            | 6                | YES         | null                                                                                        | timestamp with time zone | null                                                   |
| journey_inventory       | expires_at              | 7                | YES         | null                                                                                        | timestamp with time zone | null                                                   |
| journey_inventory       | source_event_id         | 8                | YES         | null                                                                                        | uuid                     | null                                                   |
| journey_journal         | id                      | 1                | NO          | gen_random_uuid()                                                                           | uuid                     | null                                                   |
| journey_journal         | user_id                 | 2                | NO          | null                                                                                        | uuid                     | null                                                   |
| journey_journal         | message                 | 3                | NO          | null                                                                                        | text                     | null                                                   |
| journey_journal         | severity                | 4                | YES         | 'info'::character varying                                                                   | character varying        | null                                                   |
| journey_journal         | source_event_id         | 5                | YES         | null                                                                                        | uuid                     | null                                                   |
| journey_journal         | created_at              | 6                | YES         | now()                                                                                       | timestamp with time zone | null                                                   |
| journey_notifications   | id                      | 1                | NO          | gen_random_uuid()                                                                           | uuid                     | null                                                   |
| journey_notifications   | user_id                 | 2                | YES         | null                                                                                        | uuid                     | null                                                   |
| journey_notifications   | source_event_id         | 3                | YES         | null                                                                                        | uuid                     | null                                                   |
| journey_notifications   | category                | 4                | NO          | null                                                                                        | notification_category    | {ACHIEVEMENT,HAZARD,CHALLENGE,REGION,SYSTEM,INVENTORY} |
| journey_notifications   | severity                | 5                | NO          | null                                                                                        | event_severity           | {INFO,SUCCESS,WARNING,DANGER}                          |
| journey_notifications   | status                  | 6                | YES         | 'UNREAD'::notification_status                                                               | notification_status      | {UNREAD,READ,ARCHIVED}                                 |
| journey_notifications   | title                   | 7                | NO          | null                                                                                        | text                     | null                                                   |
| journey_notifications   | message                 | 8                | NO          | null                                                                                        | text                     | null                                                   |
| journey_notifications   | action_type             | 9                | YES         | null                                                                                        | text                     | null                                                   |
| journey_notifications   | action_payload          | 10               | YES         | null                                                                                        | jsonb                    | null                                                   |
| journey_notifications   | created_at              | 11               | YES         | now()                                                                                       | timestamp with time zone | null                                                   |
| journey_notifications   | read_at                 | 12               | YES         | null                                                                                        | timestamp with time zone | null                                                   |
| journey_notifications   | archived_at             | 13               | YES         | null                                                                                        | timestamp with time zone | null                                                   |
| journey_passport_stamps | id                      | 1                | NO          | gen_random_uuid()                                                                           | uuid                     | null                                                   |
| journey_passport_stamps | user_id                 | 2                | NO          | null                                                                                        | uuid                     | null                                                   |
| journey_passport_stamps | stamp_key               | 3                | NO          | null                                                                                        | character varying        | null                                                   |
| journey_passport_stamps | unlocked_at             | 4                | NO          | now()                                                                                       | timestamp with time zone | null                                                   |
| journey_profiles        | id                      | 1                | NO          | null                                                                                        | uuid                     | null                                                   |
| journey_profiles        | username                | 2                | NO          | null                                                                                        | text                     | null                                                   |
| journey_profiles        | timezone                | 3                | YES         | 'Asia/Jakarta'::text                                                                        | text                     | null                                                   |
| journey_profiles        | last_timezone_change_at | 4                | YES         | null                                                                                        | timestamp with time zone | null                                                   |
| journey_profiles        | active_path             | 5                | YES         | 'UNASSIGNED'::player_path                                                                   | player_path              | {SENTINEL,CATALYST,PHANTOM,UNASSIGNED,VANGUARD}        |
| journey_profiles        | path_cooldown_until     | 6                | YES         | null                                                                                        | timestamp with time zone | null                                                   |
| journey_profiles        | has_completed_setup     | 7                | YES         | false                                                                                       | boolean                  | null                                                   |
| journey_profiles        | feature_unlocks         | 8                | YES         | '{}'::jsonb                                                                                 | jsonb                    | null                                                   |
| journey_profiles        | expected_monthly_income | 9                | YES         | 0                                                                                           | numeric                  | null                                                   |
| journey_profiles        | monthly_savings_target  | 10               | YES         | 0                                                                                           | numeric                  | null                                                   |
| journey_profiles        | primary_payday          | 11               | YES         | null                                                                                        | integer                  | null                                                   |
| journey_profiles        | app_preferences         | 12               | YES         | '{"theme": "system", "privacy_mode": false, "reduced_motion": false}'::jsonb                | jsonb                    | null                                                   |
| journey_profiles        | notification_settings   | 13               | YES         | '{"hazard_alerts": true, "daily_reminder": true, "achievement_notifications": true}'::jsonb | jsonb                    | null                                                   |
| journey_profiles        | current_hp              | 14               | YES         | 100                                                                                         | numeric                  | null                                                   |