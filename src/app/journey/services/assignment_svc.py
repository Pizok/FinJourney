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

        # DEADLINE WORKAROUND: The user requested to only assign the first challenge 
        # and then show the 'await card' (IdleState) indefinitely for now.
        return None

    async def _assign_challenge(self, user_id: str, template_id: str, context: dict | None = None) -> dict:
        """Helper to build and insert the challenge payload."""
        template = get_template(template_id)
        payload = template.build_record(user_id, context)
        
        logger.info(f"Assigning challenge {template_id} to user {user_id}")
        return await self._profile_repo.insert_challenge(payload)
