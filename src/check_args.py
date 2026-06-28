import asyncio
from app.db.supabase import init_supabase, get_admin_db
async def main():
    await init_supabase()
    db = get_admin_db()
    res = await db.rpc('run_sql', {'query': "SELECT pg_get_function_arguments(oid) FROM pg_proc WHERE proname = 'get_monthly_debt_payments';"}).execute()
    print(res.data)
asyncio.run(main())
