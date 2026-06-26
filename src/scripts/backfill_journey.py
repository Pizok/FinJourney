#!/usr/bin/env python3
"""
scripts/backfill_journey.py

Backfills the initial Journey state (Region 1, Node 1) for users who 
completed onboarding prior to the fix being deployed.

Usage:
  python -m scripts.backfill_journey --dry-run
  python -m scripts.backfill_journey
"""

import asyncio
import argparse
import sys
import os

# Append the frontend app to path so we can import app modules
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))

from app.db.supabase import get_admin_db, init_supabase
from app.journey.services.advancement_svc import evaluate_node_advancement

async def run_backfill(dry_run: bool):
    print("==================================================")
    print(" Journey State Backfill Script")
    print("==================================================")
    if dry_run:
        print(" MODE: DRY RUN (No database writes will occur)")
    else:
        print(" MODE: LIVE RUN (Writes are enabled)")
    print("==================================================\n")

    await init_supabase()
    db = get_admin_db()

    # 1. Fetch all users who have completed setup
    try:
        profiles_res = await db.table("journey_profiles").select("id, username").eq("has_completed_setup", True).execute()
        profiles = profiles_res.data
    except Exception as e:
        print(f"FAILED to fetch profiles: {e}")
        return

    total_checked = len(profiles)
    seeded_count = 0
    skipped_count = 0
    failed_count = 0

    print(f"Found {total_checked} onboarded users to check.\n")

    for p in profiles:
        user_id = p["id"]
        username = p["username"]

        # Check if region already exists
        try:
            regions_res = await db.table("journey_regions").select("id").eq("user_id", user_id).execute()
            
            if regions_res.data:
                skipped_count += 1
                # print(f"SKIP: {username} ({user_id}) - Region already exists")
                continue
        except Exception as e:
            print(f"ERROR checking region for {username} ({user_id}): {e}")
            failed_count += 1
            continue

        # Region doesn't exist, needs backfill
        if dry_run:
            print(f"WOULD SEED: {username} ({user_id})")
            seeded_count += 1
        else:
            print(f"SEEDING: {username} ({user_id})...", end=" ")
            try:
                await evaluate_node_advancement(db, user_id)
                print("OK")
                seeded_count += 1
            except Exception as e:
                print(f"FAILED: {e}")
                failed_count += 1

    print("\n==================================================")
    print(" SUMMARY")
    print("==================================================")
    print(f" Total Checked : {total_checked}")
    print(f" Seeded        : {seeded_count}")
    print(f" Skipped       : {skipped_count} (already had region)")
    print(f" Failed        : {failed_count}")
    print("==================================================")

if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Backfill journey state for existing users.")
    parser.add_argument("--dry-run", action="store_true", help="Run the script without making any database changes.")
    args = parser.parse_args()

    asyncio.run(run_backfill(args.dry_run))
