-- Fix: explicit cast of recurrence_type text value to the recurrence_type enum.
-- The ->> operator returns text, and Postgres will not implicitly cast text to
-- a user-defined enum in a VALUES list, only for string literals. This caused
-- a 42804 type mismatch error blocking onboarding completion.

CREATE OR REPLACE FUNCTION save_onboarding_baselines(
    p_user_id    UUID,
    p_incomes    JSONB,
    p_fixed_costs JSONB,
    p_savings    JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    elem              JSONB;
    v_total_income    NUMERIC := 0;
    v_total_savings   NUMERIC := 0;
BEGIN
    -- 1. Soft-delete income_streams
    UPDATE income_streams
    SET deleted_at = NOW()
    WHERE user_id = p_user_id AND deleted_at IS NULL;

    -- 2. Hard-delete fixed_expenses (table has no deleted_at column)
    DELETE FROM fixed_expenses
    WHERE user_id = p_user_id;

    -- 3. Soft-delete savings_targets
    UPDATE savings_targets
    SET deleted_at = NOW(), status = 'archived'
    WHERE user_id = p_user_id AND deleted_at IS NULL;

    -- 4. Insert income_streams and compute total
    IF jsonb_typeof(p_incomes) = 'array' THEN
        FOR elem IN SELECT * FROM jsonb_array_elements(p_incomes)
        LOOP
            INSERT INTO income_streams (user_id, name, amount)
            VALUES (
                p_user_id,
                elem->>'name',
                (elem->>'amount')::NUMERIC
            );
            v_total_income := v_total_income + (elem->>'amount')::NUMERIC;
        END LOOP;
    END IF;

    -- 5. Insert fixed_expenses
    -- IMPORTANT: Use explicit ::recurrence_type cast. The ->> operator returns
    -- text, and Postgres does NOT implicitly cast text -> user-defined enum in
    -- VALUES lists (42804). A literal string works but a text expression does not.
    IF jsonb_typeof(p_fixed_costs) = 'array' THEN
        FOR elem IN SELECT * FROM jsonb_array_elements(p_fixed_costs)
        LOOP
            INSERT INTO fixed_expenses (user_id, name, amount, recurrence_type, recurrence_value)
            VALUES (
                p_user_id,
                elem->>'name',
                (elem->>'amount')::NUMERIC,
                (elem->>'recurrence_type')::recurrence_type,
                elem->>'recurrence_value'
            );
        END LOOP;
    END IF;

    -- 6. Insert savings_targets and compute total
    IF jsonb_typeof(p_savings) = 'array' THEN
        FOR elem IN SELECT * FROM jsonb_array_elements(p_savings)
        LOOP
            INSERT INTO savings_targets (user_id, name, target_amount, deadline, priority, monthly_contribution_target)
            VALUES (
                p_user_id,
                elem->>'name',
                (elem->>'target_amount')::NUMERIC,
                (elem->>'deadline')::DATE,
                COALESCE(elem->>'priority', 'medium'),
                (elem->>'monthly_contribution_target')::NUMERIC
            );

            v_total_savings := v_total_savings + (elem->>'monthly_contribution_target')::NUMERIC;
        END LOOP;
    END IF;

    -- 7. Update journey_profiles with the computed totals
    UPDATE journey_profiles
    SET expected_monthly_income = v_total_income,
        monthly_savings_target  = v_total_savings
    WHERE id = p_user_id;

END;
$$;
