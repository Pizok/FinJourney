-- supabase/migrations/20260628030000_atomic_operations.sql

CREATE OR REPLACE FUNCTION save_onboarding_baselines(
    p_user_id UUID,
    p_incomes JSONB,
    p_fixed_costs JSONB,
    p_savings JSONB
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    elem JSONB;
    v_total_income NUMERIC := 0;
    v_total_savings NUMERIC := 0;
BEGIN
    -- 1. Soft-delete income_streams
    UPDATE income_streams
    SET deleted_at = NOW()
    WHERE user_id = p_user_id AND deleted_at IS NULL;

    -- 2. Soft-delete savings_targets
    UPDATE savings_targets
    SET deleted_at = NOW()
    WHERE user_id = p_user_id AND deleted_at IS NULL;

    -- 3. Hard-delete fixed_expenses
    DELETE FROM fixed_expenses
    WHERE user_id = p_user_id;

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
    IF jsonb_typeof(p_fixed_costs) = 'array' THEN
        FOR elem IN SELECT * FROM jsonb_array_elements(p_fixed_costs)
        LOOP
            -- Postgres will implicitly cast text to the enum type in INSERT VALUES list.
            INSERT INTO fixed_expenses (user_id, name, amount, recurrence_type, recurrence_value)
            VALUES (
                p_user_id,
                elem->>'name',
                (elem->>'amount')::NUMERIC,
                elem->>'recurrence_type',
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
            
            -- We extract monthly_contribution_target to compute total monthly_savings_target
            v_total_savings := v_total_savings + COALESCE((elem->>'monthly_contribution_target')::NUMERIC, 0);
        END LOOP;
    END IF;

    -- 7. Update journey_profiles with the computed totals
    UPDATE journey_profiles
    SET expected_monthly_income = v_total_income,
        monthly_savings_target = v_total_savings
    WHERE id = p_user_id;

END;
$$;

-- Grant EXECUTE permission to authenticated users
GRANT EXECUTE ON FUNCTION save_onboarding_baselines(UUID, JSONB, JSONB, JSONB) TO authenticated;


CREATE OR REPLACE FUNCTION delete_transaction_atomic(
    p_transaction_id UUID,
    p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_type TEXT;
    v_amount NUMERIC;
    v_primary_wallet_id UUID;
    v_source_wallet_id UUID;
    v_destination_wallet_id UUID;
    v_transfer_group_id UUID;
    v_savings_target_id UUID;
    v_status TEXT;
BEGIN
    -- 1. Fetch and verify ownership/existence
    SELECT type, amount, primary_wallet_id, source_wallet_id, 
           destination_wallet_id, transfer_group_id, savings_target_id, status
    INTO v_type, v_amount, v_primary_wallet_id, v_source_wallet_id, 
         v_destination_wallet_id, v_transfer_group_id, v_savings_target_id, v_status
    FROM transactions
    WHERE id = p_transaction_id AND user_id = p_user_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'transaction_not_found';
    END IF;

    IF v_status = 'deleted' THEN
        RAISE EXCEPTION 'already_deleted';
    END IF;

    -- 2. Reverse balances based on transaction type
    IF v_type = 'expense' AND v_savings_target_id IS NOT NULL THEN
        -- Reverse savings_targets.current_amount (subtract amount)
        UPDATE savings_targets
        SET current_amount = current_amount - v_amount
        WHERE id = v_savings_target_id AND user_id = p_user_id;
        
        -- Soft-delete the single transaction row
        UPDATE transactions
        SET status = 'deleted', deleted_at = NOW()
        WHERE id = p_transaction_id AND user_id = p_user_id;

    ELSIF v_type = 'expense' THEN
        -- Reverse wallet balance (add amount back)
        IF v_primary_wallet_id IS NOT NULL THEN
            UPDATE wallets
            SET balance = balance + v_amount
            WHERE id = v_primary_wallet_id AND user_id = p_user_id;
        END IF;

        -- Soft-delete the single transaction row
        UPDATE transactions
        SET status = 'deleted', deleted_at = NOW()
        WHERE id = p_transaction_id AND user_id = p_user_id;

    ELSIF v_type = 'income' THEN
        -- Reverse wallet balance (subtract amount)
        IF v_primary_wallet_id IS NOT NULL THEN
            UPDATE wallets
            SET balance = balance - v_amount
            WHERE id = v_primary_wallet_id AND user_id = p_user_id;
        END IF;

        -- Soft-delete the single transaction row
        UPDATE transactions
        SET status = 'deleted', deleted_at = NOW()
        WHERE id = p_transaction_id AND user_id = p_user_id;

    ELSIF v_type = 'transfer' THEN
        -- Revert balances for both wallets linked in the transfer group
        IF v_transfer_group_id IS NOT NULL THEN
            -- We use the source and destination wallets found on the current row
            IF v_source_wallet_id IS NOT NULL THEN
                -- Add back to source
                UPDATE wallets
                SET balance = balance + v_amount
                WHERE id = v_source_wallet_id AND user_id = p_user_id;
            END IF;
            IF v_destination_wallet_id IS NOT NULL THEN
                -- Subtract from destination
                UPDATE wallets
                SET balance = balance - v_amount
                WHERE id = v_destination_wallet_id AND user_id = p_user_id;
            END IF;

            -- Soft-delete ALL transaction rows linked to this transfer group
            UPDATE transactions
            SET status = 'deleted', deleted_at = NOW()
            WHERE transfer_group_id = v_transfer_group_id AND user_id = p_user_id;
        ELSE
            -- Fallback in case transfer_group_id is missing (should not happen on valid transfers)
            UPDATE transactions
            SET status = 'deleted', deleted_at = NOW()
            WHERE id = p_transaction_id AND user_id = p_user_id;
        END IF;
    END IF;
END;
$$;

-- Grant EXECUTE permission to authenticated users
GRANT EXECUTE ON FUNCTION delete_transaction_atomic(UUID, UUID) TO authenticated;
