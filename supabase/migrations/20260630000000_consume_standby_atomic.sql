CREATE OR REPLACE FUNCTION consume_standby_token_atomic(p_user_id UUID, p_ends_at TIMESTAMPTZ)
RETURNS jsonb
LANGUAGE plpgsql
AS $$
DECLARE
    v_active_count INT;
    v_result RECORD;
BEGIN
    SELECT count(*) INTO v_active_count FROM journey_inventory 
    WHERE user_id = p_user_id AND status = 'ACTIVE' AND type = 'STANDBY_TOKEN';
    
    IF v_active_count > 0 THEN
        RAISE EXCEPTION 'Cannot activate token: another token is already ACTIVE.';
    END IF;

    UPDATE journey_inventory
    SET status = 'ACTIVE', activated_at = now(), expires_at = p_ends_at
    WHERE id = (
        SELECT id FROM journey_inventory 
        WHERE user_id = p_user_id AND status = 'AVAILABLE' AND type = 'STANDBY_TOKEN'
        ORDER BY created_at ASC, id ASC
        LIMIT 1
        FOR UPDATE SKIP LOCKED
    )
    RETURNING * INTO v_result;

    IF v_result.id IS NULL THEN
        RAISE EXCEPTION 'No AVAILABLE standby tokens found.';
    END IF;

    RETURN to_jsonb(v_result);
END;
$$;
