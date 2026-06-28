import asyncio
from app.db.supabase import init_supabase, get_admin_db
async def main():
    await init_supabase()
    db = get_admin_db()
    res = await db.rpc('run_sql', {'query': "SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'loans';"}).execute()
    for row in res.data: print(row)
asyncio.run(main())
