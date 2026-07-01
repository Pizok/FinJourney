-- Fix RPCs for loan and savings transactions

-- RPC for Logging Savings Contributions Atomically
CREATE OR REPLACE FUNCTION log_savings_contribution(
    p_user_id UUID,
    p_wallet_id UUID,
    p_target_id UUID,
    p_amount NUMERIC
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- 1. Deduct from source wallet
    UPDATE wallets
    SET balance = balance - p_amount
    WHERE id = p_wallet_id AND user_id = p_user_id;

    -- 2. Increment savings target current_amount
    UPDATE savings_targets
    SET current_amount = current_amount + p_amount
    WHERE id = p_target_id AND user_id = p_user_id;

    -- 3. Insert the expense transaction
    INSERT INTO transactions (
        id, user_id, status, type, amount, payment_method, note, 
        transaction_date, primary_wallet_id, savings_target_id, logged_at
    ) VALUES (
        gen_random_uuid(),
        p_user_id,
        'active',
        'expense',
        p_amount,
        'transfer',
        'Savings contribution',
        NOW(),
        p_wallet_id,
        p_target_id,
        NOW()
    );
END;
$$;

-- RPC for Logging Loan Repayments Atomically
CREATE OR REPLACE FUNCTION log_loan_repayment(
    p_user_id UUID,
    p_wallet_id UUID,
    p_loan_id UUID,
    p_amount NUMERIC
) RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_total_amount NUMERIC;
    v_new_paid_amount NUMERIC;
BEGIN
    -- 1. Deduct from source wallet
    UPDATE wallets
    SET balance = balance - p_amount
    WHERE id = p_wallet_id AND user_id = p_user_id;

    -- 2. Increment loan paid_amount and check if paid off
    UPDATE loans
    SET paid_amount = paid_amount + p_amount
    WHERE id = p_loan_id AND user_id = p_user_id
    RETURNING total_amount, paid_amount INTO v_total_amount, v_new_paid_amount;

    -- If the loan is fully paid, update status to 'PAID_OFF'
    IF v_new_paid_amount >= v_total_amount THEN
        UPDATE loans
        SET status = 'PAID_OFF'
        WHERE id = p_loan_id AND user_id = p_user_id;
    END IF;

    -- 3. Insert the expense transaction
    INSERT INTO transactions (
        id, user_id, status, type, amount, payment_method, note, 
        transaction_date, primary_wallet_id, loan_id, logged_at
    ) VALUES (
        gen_random_uuid(),
        p_user_id,
        'active',
        'expense',
        p_amount,
        'transfer',
        'Loan repayment',
        NOW(),
        p_wallet_id,
        p_loan_id,
        NOW()
    );
END;
$$;
