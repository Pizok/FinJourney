-- ============================================================
-- Migration: Update journey_profiles for Settings Module
-- Module:    Settings & Account Management
-- Domain:    Backend Logic
-- ============================================================

-- ── 1. Financial columns ─────────────────────────────────────────────────────

ALTER TABLE journey_profiles
    ADD COLUMN IF NOT EXISTS primary_payday             INTEGER         NULL
        CONSTRAINT chk_payday_range CHECK (primary_payday BETWEEN 1 AND 31),

    ADD COLUMN IF NOT EXISTS expected_monthly_income    NUMERIC(15, 2)  NOT NULL DEFAULT 0
        CONSTRAINT chk_income_non_negative CHECK (expected_monthly_income >= 0),

    ADD COLUMN IF NOT EXISTS monthly_savings_target     NUMERIC(15, 2)  NOT NULL DEFAULT 0
        CONSTRAINT chk_savings_non_negative CHECK (monthly_savings_target >= 0);

-- ── 2. Cooldown / change-tracking timestamps ─────────────────────────────────

ALTER TABLE journey_profiles
    ADD COLUMN IF NOT EXISTS last_timezone_change_at    TIMESTAMPTZ     NULL,
    ADD COLUMN IF NOT EXISTS last_username_change_at    TIMESTAMPTZ     NULL,
    ADD COLUMN IF NOT EXISTS path_changed_at            TIMESTAMPTZ     NULL,

    -- Derived cooldown deadline columns — backend writes directly for clarity.
    -- Alternative: compute on the fly from path_changed_at + INTERVAL '180 days'.
    -- We store explicitly so the hydration query is a single table read.
    ADD COLUMN IF NOT EXISTS path_cooldown_until        TIMESTAMPTZ     NULL;

-- ── 3. JSONB preference blobs ─────────────────────────────────────────────────

ALTER TABLE journey_profiles
    ADD COLUMN IF NOT EXISTS app_preferences            JSONB           NOT NULL DEFAULT '{}'::JSONB,
    ADD COLUMN IF NOT EXISTS notification_settings      JSONB           NOT NULL DEFAULT '{}'::JSONB;

-- ── 4. Seed sensible defaults into JSONB columns ──────────────────────────────

UPDATE journey_profiles
SET
    app_preferences = COALESCE(
        NULLIF(app_preferences, '{}'::JSONB),
        jsonb_build_object(
            'theme',          'clear-night',
            'reduced_motion', false,
            'privacy_mode',   false
        )
    ),
    notification_settings = COALESCE(
        NULLIF(notification_settings, '{}'::JSONB),
        jsonb_build_object(
            'daily_reminder',               true,
            'hazard_alerts',                true,
            'achievement_notifications',    true
        )
    )
WHERE
    app_preferences = '{}'::JSONB
    OR notification_settings = '{}'::JSONB;

-- ── 5. Indexes ────────────────────────────────────────────────────────────────

-- Timezone bucket scheduling (cron scheduler groups by timezone)
CREATE INDEX IF NOT EXISTS idx_journey_profiles_timezone
    ON journey_profiles (timezone)
    WHERE timezone IS NOT NULL;

-- Cooldown lock queries (frontend lock-until hydration)
CREATE INDEX IF NOT EXISTS idx_journey_profiles_path_cooldown_until
    ON journey_profiles (path_cooldown_until)
    WHERE path_cooldown_until IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_journey_profiles_last_username_change_at
    ON journey_profiles (last_username_change_at)
    WHERE last_username_change_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_journey_profiles_last_timezone_change_at
    ON journey_profiles (last_timezone_change_at)
    WHERE last_timezone_change_at IS NOT NULL;

-- ── 6. JSONB index for app_preferences.theme (shop theme lookup) ──────────────

CREATE INDEX IF NOT EXISTS idx_journey_profiles_app_pref_theme
    ON journey_profiles ((app_preferences->>'theme'));

-- ── 7. RLS policy guard — settings rows are always owner-only ────────────────
-- Assumes existing RLS is enabled on journey_profiles.
-- These policies govern the new columns automatically via row-level scope.
-- No additional policy rows are required unless column-level security is used.

-- ── 8. Verify migration ───────────────────────────────────────────────────────

DO $$
DECLARE
    _missing TEXT;
BEGIN
    SELECT string_agg(col, ', ')
    INTO   _missing
    FROM   unnest(ARRAY[
               'primary_payday',
               'expected_monthly_income',
               'monthly_savings_target',
               'last_timezone_change_at',
               'last_username_change_at',
               'path_changed_at',
               'path_cooldown_until',
               'app_preferences',
               'notification_settings'
           ]) AS col
    WHERE  NOT EXISTS (
        SELECT 1
        FROM   information_schema.columns c
        WHERE  c.table_name  = 'journey_profiles'
        AND    c.column_name = col
    );

    IF _missing IS NOT NULL THEN
        RAISE EXCEPTION 'Migration incomplete — missing columns: %', _missing;
    END IF;

    RAISE NOTICE 'Migration verified: all settings columns present on journey_profiles.';
END;
$$;
