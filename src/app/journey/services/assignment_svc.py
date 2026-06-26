"""
src/app/journey/services/assignment_svc.py

Smart Context-Aware Challenge Assignment Engine.
Evaluates user state and assigns the most appropriate challenge based on a priority tree.
"""
import logging
import random
from datetime import datetime, timezone
from typing import Optional

from supabase import AsyncClient

from app.journey.challenge_templates import (
    get_template,
    get_auto_assign_templates,
    ChallengeTemplate,
    REST_AND_RECOVER,
    DAILY_TRACKER,
    BUDGET_GUARDIAN,
    IRON_BUDGET
)
from app.journey.repos.profile_repo import ProfileRepository

logger = logging.getLogger(__name__)


class ChallengeAssignmentService:
    def __init__(self, db: AsyncClient, profile_repo: ProfileRepository):
        self._db = db
        self._profile_repo = profile_repo

    async def evaluate_triggers(self, user_id: str, trigger_event: str, last_challenge_id: Optional[str] = None) -> dict | None:
        """
        Evaluates the user's financial condition and assigns a new challenge.
        
        Priority:
        1. Explicit Trigger Match (e.g. onboarding_complete -> FIRST_STEPS)
        2. HP Recovery (HP < 50)
        3. Debt Recovery (Missed payment)
        4. Savings Catch-Up (Behind on monthly target)
        5. Maintenance (Debt Guardian or Savings Consistency)
        6. Rest & Recover (If no critical/urgent conditions exist and they just completed a challenge)
        7. Fillers (Daily Tracker, Budget Guardian, Iron Budget)
        """
        now = datetime.now(timezone.utc)
        
        # 1. Explicit Trigger Match
        # (e.g. FIRST_STEPS triggers on onboarding_complete)
        auto_templates = get_auto_assign_templates(trigger_event)
        if auto_templates:
            return await self._assign_challenge(user_id, auto_templates[0].template_id)

        # Fetch user profile for Level and HP
        profile_res = await self._db.table("journey_profiles").select("current_hp, level, current_streak").eq("id", user_id).maybe_single().execute()
        profile = profile_res.data or {}
        hp = profile.get("current_hp", 100)
        level = profile.get("level", 1)

        # 2. HP Recovery (Critical)
        if hp < 50:
            return await self._assign_challenge(user_id, "HP_RECOVERY")

        # Fetch active loans
        loans_res = await self._db.table("loans").select("*").eq("user_id", user_id).eq("status", "ACTIVE").execute()
        loans = loans_res.data or []

        # 3. Debt Recovery
        # Condition: next_due_date < now AND (last_payment_date is null OR last_payment_date < next_due_date)
        has_loan = len(loans) > 0
        needs_debt_recovery = False
        for loan in loans:
            next_due = loan.get("next_due_date")
            last_pay = loan.get("last_payment_date")
            
            if next_due:
                next_due_dt = datetime.fromisoformat(next_due).replace(tzinfo=timezone.utc)
                if next_due_dt < now:
                    if not last_pay:
                        needs_debt_recovery = True
                        break
                    else:
                        last_pay_dt = datetime.fromisoformat(last_pay).replace(tzinfo=timezone.utc)
                        if last_pay_dt < next_due_dt:
                            needs_debt_recovery = True
                            break

        if needs_debt_recovery:
            return await self._assign_challenge(user_id, "DEBT_RECOVERY")

        # Fetch active savings targets
        savings_res = await self._db.table("savings_targets").select("*").eq("user_id", user_id).eq("status", "active").execute()
        savings_targets = savings_res.data or []

        # 4. Savings Catch-Up
        start_of_month = now.replace(day=1, hour=0, minute=0, second=0, microsecond=0).isoformat()
        
        needs_savings_catchup = False
        remaining_savings_needed = 0
        
        for target in savings_targets:
            monthly_target = float(target.get("monthly_contribution_target", 0))
            if monthly_target > 0:
                # Sum contributions this month
                tx_res = await self._db.table("transactions")\
                    .select("amount")\
                    .eq("user_id", user_id)\
                    .eq("savings_target_id", target["id"])\
                    .gte("date", start_of_month)\
                    .execute()
                
                contributed = sum(float(tx["amount"]) for tx in (tx_res.data or []))
                if contributed < monthly_target:
                    needs_savings_catchup = True
                    remaining_savings_needed = monthly_target - contributed
                    break # Take the first one that needs catch-up

        if needs_savings_catchup:
            return await self._assign_challenge(user_id, "SAVINGS_CATCH_UP", context={"remaining_savings_needed": remaining_savings_needed})

        # 5. Maintenance (Debt Guardian vs Savings Consistency)
        # Tie-breaker: Debt Guardian wins over Savings Consistency
        if has_loan:
            return await self._assign_challenge(user_id, "DEBT_GUARDIAN")
            
        if len(savings_targets) > 0:
            # We know they aren't behind because Priority 4 didn't trigger, 
            # so they are consistent. Let's encourage them to hit the target.
            # Find the largest monthly target
            largest_target = max(float(t.get("monthly_contribution_target", 0)) for t in savings_targets)
            if largest_target > 0:
                return await self._assign_challenge(user_id, "SAVINGS_CONSISTENCY", context={"monthly_contribution_target": largest_target})

        # 6. Rest & Recover
        # Triggered after *any* completed challenge (except Rest itself), provided no urgent conditions above fired.
        # This acts as a breather.
        if trigger_event == "challenge_completed" and last_challenge_id != "REST_AND_RECOVER":
            return await self._assign_challenge(user_id, "REST_AND_RECOVER")

        # 7. Fillers
        # Exclude the last completed/failed challenge from the pool
        filler_pool = ["DAILY_TRACKER", "BUDGET_GUARDIAN"]
        if level >= 5:
            filler_pool.append("IRON_BUDGET")
            
        if last_challenge_id in filler_pool and len(filler_pool) > 1:
            filler_pool.remove(last_challenge_id)
            
        chosen_filler = random.choice(filler_pool)
        return await self._assign_challenge(user_id, chosen_filler)

    async def _assign_challenge(self, user_id: str, template_id: str, context: dict | None = None) -> dict:
        """Helper to build and insert the challenge payload."""
        template = get_template(template_id)
        payload = template.build_record(user_id, context)
        
        logger.info(f"Assigning challenge {template_id} to user {user_id}")
        return await self._profile_repo.insert_challenge(payload)
