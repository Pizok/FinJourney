import asyncio
from dotenv import load_dotenv
load_dotenv('src/.env')

from app.db.supabase import init_supabase, get_admin_db

async def run():
    await init_supabase()
    db = get_admin_db()
    sql = \"\"\"
CREATE OR REPLACE FUNCTION consume_standby_token_atomic(p_user_id UUID, p_ends_at TIMESTAMPTZ)
RETURNS jsonb
LANGUAGE plpgsql
AS $function
DECLARE
    v_active_count INT;
    v_result RECORD;
BEGIN
    SELECT count(*) INTO v_active_count FROM journey_inventory 
    WHERE user_id = p_user_id AND status = 'ACTIVE' AND type = 'STANDBY_TOKEN';
    
    IF v_active_count > 0 THEN
        RETURN jsonb_build_object(
            'status', 'error',
            'code', 'ALREADY_ACTIVE',
            'message', 'Cannot activate token: another token is already ACTIVE.'
        );
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
        RETURN jsonb_build_object(
            'status', 'error',
            'code', 'NONE_AVAILABLE',
            'message', 'No AVAILABLE standby tokens found.'
        );
    END IF;

    RETURN jsonb_build_object(
        'status', 'success',
        'data', to_jsonb(v_result)
    );
END;
$function;
\"\"\"
    # Wait, supabase-py doesn't have execute_sql...
    # We might need to use psycopg2 or asyncpg, but they might not be installed.
    print('Ready to apply migration.')

if __name__ == '__main__':
    asyncio.run(run())
