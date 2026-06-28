import asyncio
from app.db.supabase import init_supabase, get_admin_db

async def main():
    await init_supabase()
    db = get_admin_db()
    
    user_id = "a32decbf-0ff4-4e32-8345-30c24899a817"
    
    res = await db.table("journey_profiles").select("id, user_id, expected_monthly_income").eq("id", user_id).execute()
    print("Query by id:", res.data)
    
    res2 = await db.table("journey_profiles").select("id, user_id, expected_monthly_income").eq("user_id", user_id).execute()
    print("Query by user_id:", res2.data)

    res3 = await db.table("baselines").select("*").eq("user_id", user_id).execute()
    print("Baselines table:", res3.data)

if __name__ == "__main__":
    asyncio.run(main())
