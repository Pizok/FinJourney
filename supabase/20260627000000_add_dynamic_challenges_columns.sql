-- Add missing columns for smart challenge assignment

-- 1. loans table needs last_payment_date
ALTER TABLE public.loans ADD COLUMN last_payment_date date;

-- 2. savings_targets needs monthly_contribution_target
ALTER TABLE public.savings_targets ADD COLUMN monthly_contribution_target numeric DEFAULT 0;
