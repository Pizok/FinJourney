import asyncio
from dotenv import load_dotenv
load_dotenv('.env')

from fastapi import Request
from supabase import create_client
import os

from app.journey.services.bootstrap_svc import BootstrapService
from app.api.v1.dependencies import _get_admin_db

async def run():
    user_id = "1d5e0ca9-3911-40c0-8da9-9e5a2d288704"
    db = _get_admin_db()
    svc = BootstrapService(db)
    try:
        data = await svc.get_full_dashboard(user_id)
        print("Success! Keys:", data.keys())
    except Exception as e:
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    asyncio.run(run())
