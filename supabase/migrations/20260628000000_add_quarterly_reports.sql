CREATE TABLE public.journey_quarterly_reports (
  id uuid NOT NULL DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  quarter integer NOT NULL,          -- 1, 2, 3, or 4
  year integer NOT NULL,             -- e.g. 2025
  quarter_start date NOT NULL,
  quarter_end date NOT NULL,
  is_partial boolean NOT NULL DEFAULT false,
  computed_at timestamp with time zone DEFAULT now(),
  
  -- Journey stats
  longest_streak integer NOT NULL DEFAULT 0,
  zero_spend_days integer NOT NULL DEFAULT 0,
  
  -- Finance summary
  total_income numeric NOT NULL DEFAULT 0,
  total_expenses numeric NOT NULL DEFAULT 0,
  net_change numeric NOT NULL DEFAULT 0,
  starting_wallet_balance numeric NOT NULL DEFAULT 0,
  ending_wallet_balance numeric NOT NULL DEFAULT 0,
  
  -- Complex data as JSONB (mirrors Pydantic models)
  challenges_summary jsonb DEFAULT '[]'::jsonb,
  spending_by_category jsonb DEFAULT '[]'::jsonb,
  wallet_breakdown jsonb DEFAULT '[]'::jsonb,
  
  CONSTRAINT journey_quarterly_reports_pkey PRIMARY KEY (id),
  CONSTRAINT journey_quarterly_reports_unique UNIQUE (user_id, quarter, year),
  CONSTRAINT journey_quarterly_reports_user_id_fkey 
    FOREIGN KEY (user_id) REFERENCES public.journey_profiles(id)
);

ALTER TABLE public.journey_quarterly_reports ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.journey_quarterly_reports TO authenticated;
GRANT SELECT ON public.journey_quarterly_reports TO service_role;

CREATE POLICY "Users can read their own quarterly reports" 
  ON public.journey_quarterly_reports 
  FOR SELECT 
  USING (auth.uid() = user_id);
