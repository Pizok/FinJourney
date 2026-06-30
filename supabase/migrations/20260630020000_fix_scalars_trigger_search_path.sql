-- Fix sync_journey_profile_scalars:
-- 1. Pin search_path = public so SECURITY DEFINER resolves table names correctly.
-- 2. Guard against mid-cascade deletes: if journey_profiles row is already gone, skip.

DROP TRIGGER IF EXISTS on_income_stream_change ON income_streams;
DROP TRIGGER IF EXISTS on_savings_target_change ON savings_targets;
DROP FUNCTION IF EXISTS sync_journey_profile_scalars();

CREATE OR REPLACE FUNCTION sync_journey_profile_scalars()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    target_user_id uuid;
    total_income    numeric;
    total_savings   numeric;
BEGIN
    -- Safely get the user_id regardless of operation type
    target_user_id := COALESCE(NEW.user_id, OLD.user_id);

    -- Guard: if the journey_profiles row is already gone (e.g. mid-cascade user delete),
    -- there is nothing to sync — return early to avoid errors.
    IF NOT EXISTS (
        SELECT 1 FROM journey_profiles WHERE id = target_user_id
    ) THEN
        RETURN NULL;
    END IF;

    -- Calculate total active income
    SELECT COALESCE(SUM(amount), 0)
    INTO total_income
    FROM income_streams
    WHERE user_id = target_user_id
      AND deleted_at IS NULL;

    -- Calculate total active savings targets
    SELECT COALESCE(SUM(monthly_contribution_target), 0)
    INTO total_savings
    FROM savings_targets
    WHERE user_id = target_user_id
      AND deleted_at IS NULL
      AND status = 'active';

    -- Update the journey_profiles table
    UPDATE journey_profiles
    SET
        expected_monthly_income = total_income,
        monthly_savings_target  = total_savings
    WHERE id = target_user_id;

    RETURN NULL;
END;
$$;

CREATE TRIGGER on_income_stream_change
    AFTER INSERT OR UPDATE OR DELETE ON income_streams
    FOR EACH ROW
    EXECUTE FUNCTION sync_journey_profile_scalars();

CREATE TRIGGER on_savings_target_change
    AFTER INSERT OR UPDATE OR DELETE ON savings_targets
    FOR EACH ROW
    EXECUTE FUNCTION sync_journey_profile_scalars();
