-- Migration: Add passport stamps table
-- Description: Creates a table to persist unlocked passport stamps and backfills existing users based on current state.

CREATE TABLE IF NOT EXISTS public.journey_passport_stamps (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES public.journey_profiles(id) ON DELETE CASCADE,
    stamp_key VARCHAR(50) NOT NULL,
    unlocked_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(user_id, stamp_key)
);

-- Enable RLS
ALTER TABLE public.journey_passport_stamps ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own passport stamps"
    ON public.journey_passport_stamps
    FOR SELECT
    USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage all passport stamps"
    ON public.journey_passport_stamps
    FOR ALL
    USING (auth.jwt()->>'role' = 'service_role');


-- ==============================================================================
-- ── BACKFILL EXISTING USERS ───────────────────────────────────────────────────
-- ==============================================================================

DO $$
DECLARE
    u RECORD;
    v_level INT;
    v_tx_count INT;
    v_total_balance NUMERIC;
BEGIN
    FOR u IN SELECT id, total_xp FROM public.journey_profiles LOOP
        -- 1. Evaluate Levels
        -- L = floor(sqrt(XP / 100)) + 1
        IF u.total_xp IS NULL THEN
            v_level := 1;
        ELSE
            v_level := floor(sqrt(u.total_xp / 100)) + 1;
        END IF;

        IF v_level >= 5 THEN
            INSERT INTO public.journey_passport_stamps (user_id, stamp_key) VALUES (u.id, 'stamp_lvl_5') ON CONFLICT DO NOTHING;
        END IF;
        IF v_level >= 10 THEN
            INSERT INTO public.journey_passport_stamps (user_id, stamp_key) VALUES (u.id, 'stamp_lvl_10') ON CONFLICT DO NOTHING;
        END IF;
        IF v_level >= 25 THEN
            INSERT INTO public.journey_passport_stamps (user_id, stamp_key) VALUES (u.id, 'stamp_lvl_25') ON CONFLICT DO NOTHING;
        END IF;
        IF v_level >= 50 THEN
            INSERT INTO public.journey_passport_stamps (user_id, stamp_key) VALUES (u.id, 'stamp_lvl_50') ON CONFLICT DO NOTHING;
        END IF;
        IF v_level >= 75 THEN
            INSERT INTO public.journey_passport_stamps (user_id, stamp_key) VALUES (u.id, 'stamp_lvl_75') ON CONFLICT DO NOTHING;
        END IF;
        IF v_level >= 100 THEN
            INSERT INTO public.journey_passport_stamps (user_id, stamp_key) VALUES (u.id, 'stamp_lvl_100') ON CONFLICT DO NOTHING;
        END IF;

        -- 2. Evaluate Transactions
        SELECT COUNT(*) INTO v_tx_count FROM public.transactions WHERE user_id = u.id AND status = 'active';
        
        IF v_tx_count >= 1 THEN
            INSERT INTO public.journey_passport_stamps (user_id, stamp_key) VALUES (u.id, 'stamp_tx_1') ON CONFLICT DO NOTHING;
        END IF;
        IF v_tx_count >= 50 THEN
            INSERT INTO public.journey_passport_stamps (user_id, stamp_key) VALUES (u.id, 'stamp_tx_50') ON CONFLICT DO NOTHING;
        END IF;

        -- 3. Evaluate Balances
        SELECT COALESCE(SUM(balance), 0) INTO v_total_balance FROM public.wallets WHERE user_id = u.id;
        
        IF v_total_balance >= 1000000 THEN
            INSERT INTO public.journey_passport_stamps (user_id, stamp_key) VALUES (u.id, 'stamp_bal_1m') ON CONFLICT DO NOTHING;
        END IF;
        IF v_total_balance >= 5000000 THEN
            INSERT INTO public.journey_passport_stamps (user_id, stamp_key) VALUES (u.id, 'stamp_bal_5m') ON CONFLICT DO NOTHING;
        END IF;
        IF v_total_balance >= 10000000 THEN
            INSERT INTO public.journey_passport_stamps (user_id, stamp_key) VALUES (u.id, 'stamp_bal_10m') ON CONFLICT DO NOTHING;
        END IF;
        IF v_total_balance >= 50000000 THEN
            INSERT INTO public.journey_passport_stamps (user_id, stamp_key) VALUES (u.id, 'stamp_bal_50m') ON CONFLICT DO NOTHING;
        END IF;

    END LOOP;
END $$;
