import asyncio
from app.db.supabase import init_supabase, get_admin_db

async def main():
    await init_supabase()
    db = get_admin_db()
    # PostgREST doesn't support raw SQL unless there is an RPC. We can just query normally using PostgREST syntax.
    import datetime
    start_of_month = datetime.date.today().replace(day=1).isoformat()
    
    res = await db.table("transactions").select("type, amount").eq("user_id", "a32decbf-0ff4-4e32-8345-30c24899a817").is_("deleted_at", "null").gte("transaction_date", start_of_month).execute()
    
    from collections import defaultdict
    summary = defaultdict(lambda: {"count": 0, "sum": 0})
    for row in res.data:
        t = row["type"]
        summary[t]["count"] += 1
        summary[t]["sum"] += row["amount"]
        
    print(dict(summary))

asyncio.run(main())
