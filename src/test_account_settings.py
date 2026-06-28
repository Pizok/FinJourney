import asyncio
import os
import sys
import traceback
from uuid import UUID

# Ensure the `src` directory is in the Python path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__))))

from app.db.supabase import init_supabase, get_admin_db
from app.services import setting_service, account_service
from app.schemas.settings_requests import (
    PatchProfileRequest,
    PatchFinancialsRequest,
    PatchPreferencesRequest,
    PatchNotificationsRequest,
    PathChangeRequest
)

# A mock event bus for testing post_path_change and reset_progress
class MockEventBus:
    async def emit(self, **kwargs):
        print(f"  [MockEventBus] Emitted: {kwargs.get('event_type')}")

async def run_tests():
    print("--- 1. Initialization ---")
    await init_supabase()
    db = get_admin_db()
    print("PASS: Supabase Initialized\n")

    # Fetch a test user
    print("--- 2. Find Test User ---")
    res = await db.table("journey_profiles").select("id").limit(1).execute()
    if not res.data:
        print("FAIL: No users found in journey_profiles.")
        return
    test_user_id = UUID(res.data[0]["id"])
    print(f"PASS: Test User ID: {test_user_id}\n")

    print("--- 3. Settings Hydration ---")
    try:
        settings_res = await setting_service.get_settings_hydration(db, test_user_id)
        if not settings_res.success:
            print("FAIL: Settings Hydration returned success=False")
        else:
            print("PASS: Settings Hydration")
    except Exception as e:
        print("FAIL: Settings Hydration Exception:")
        traceback.print_exc()
    print()

    print("--- 4. Fixed Costs ---")
    try:
        fixed_costs = await setting_service.get_fixed_costs(db, test_user_id)
        print("PASS: Fixed Costs (Total: {})".format(fixed_costs.get("total_fixed_costs")))
    except Exception as e:
        print("FAIL: Fixed Costs Exception:")
        traceback.print_exc()
    print()

    print("--- 5. Patch Profile ---")
    try:
        profile_req = PatchProfileRequest(timezone="UTC")
        await setting_service.patch_profile(db, test_user_id, profile_req)
        print("PASS: Patch Profile")
    except Exception as e:
        print("FAIL: Patch Profile Exception:")
        traceback.print_exc()
    print()

    print("--- 6. Patch Financials ---")
    try:
        fin_req = PatchFinancialsRequest(expected_monthly_income=5000000, monthly_savings_target=5000)
        res_fin = await setting_service.patch_financials(db, test_user_id, fin_req)
        print(f"PASS: Patch Financials (New Budget: {res_fin.get('projected_safe_daily_budget')})")
    except Exception as e:
        print("FAIL: Patch Financials Exception:")
        traceback.print_exc()
    print()

    print("--- 7. Patch Preferences ---")
    try:
        pref_req = PatchPreferencesRequest(theme="dark", reduced_motion=True, privacy_mode=False)
        await setting_service.patch_preferences(db, test_user_id, pref_req)
        print("PASS: Patch Preferences")
    except Exception as e:
        print("FAIL: Patch Preferences Exception:")
        traceback.print_exc()
    print()

    print("--- 8. Patch Notifications ---")
    try:
        notif_req = PatchNotificationsRequest(daily_reminder=True)
        await setting_service.patch_notifications(db, test_user_id, notif_req)
        print("PASS: Patch Notifications")
    except Exception as e:
        print("FAIL: Patch Notifications Exception:")
        traceback.print_exc()
    print()

    print("--- 9. Path Change ---")
    try:
        bus = MockEventBus()
        # This might fail with a cooldown if it was already changed, which is an expected domain error
        path_req = PathChangeRequest(new_path="VANGUARD")
        res_path = await setting_service.post_path_change(db, test_user_id, path_req, bus)
        print(f"PASS: Path Change (New Path: {res_path.get('active_path', {}).get('name')})")
    except setting_service.SettingsDomainError as e:
        print(f"PASS (Expected Error): Path Change Domain Error - {e.code}: {e.message}")
    except Exception as e:
        print("FAIL: Path Change Exception:")
        traceback.print_exc()
    print()



    print("--- 11. Export Account Data ---")
    try:
        export_payload = await account_service.export_account_data(db, test_user_id)
        print(f"PASS: Export Account Data (Transactions: {export_payload.meta.transaction_count}, Events: {export_payload.meta.event_count})")
    except Exception as e:
        print("FAIL: Export Account Data Exception:")
        traceback.print_exc()
    print()

    print("\n================ SUMMARY ================")
    print("Test run completed.")

if __name__ == "__main__":
    asyncio.run(run_tests())
