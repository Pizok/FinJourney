import asyncio
from app.db.supabase import init_supabase, get_admin_db

async def main():
    await init_supabase()
    db = get_admin_db()
    res = await db.table('journey_profiles').select('id').limit(1).execute()
    print(res.data[0]['id'] if res.data else 'none')

if __name__ == '__main__':
    asyncio.run(main())
