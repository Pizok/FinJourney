"""
src/backend/journey/services/quarterly_report_svc.py

Service for computing and persisting Quarterly Summary Reports.
"""
from __future__ import annotations

import logging
from datetime import date, datetime, timezone
import calendar
from typing import Any

from supabase import AsyncClient

logger = logging.getLogger(__name__)

class QuarterlyReportService:
    def __init__(self, db: AsyncClient) -> None:
        self._db = db

    def _get_quarter_dates(self, year: int, quarter: int) -> tuple[date, date]:
        if quarter == 1:
            return date(year, 1, 1), date(year, 3, 31)
        elif quarter == 2:
            return date(year, 4, 1), date(year, 6, 30)
        elif quarter == 3:
            return date(year, 7, 1), date(year, 9, 30)
        elif quarter == 4:
            return date(year, 10, 1), date(year, 12, 31)
        raise ValueError(f"Invalid quarter: {quarter}")

    async def compute_and_persist_quarterly_report(self, user_id: str, quarter: int, year: int) -> dict:
        q_start, q_end = self._get_quarter_dates(year, quarter)
        
        # 1. Fetch user profile to check for partial quarter
        profile_res = await self._db.table("journey_profiles").select("created_at").eq("id", user_id).single().execute()
        profile_data = profile_res.data
        if not profile_data:
            raise ValueError(f"User {user_id} not found")
            
        created_at_dt = datetime.fromisoformat(profile_data["created_at"].replace("Z", "+00:00")).date()
        is_partial = False
        if q_start <= created_at_dt <= q_end:
            is_partial = True
            
        # 2. Fetch transactions within the quarter
        # Exclude 'transfer' for net calculations, but we need them to reconstruct wallet accurately?
        # Actually, transfers don't change net wealth, but we need them if we want a per-wallet breakdown.
        # But the summary just asks for overall starting and ending balance across all wallets.
        # For overall balance, transfers between internal wallets cancel out.
        tx_res = await self._db.table("transactions").select("amount, type, category_id, transaction_date, primary_wallet_id, destination_wallet_id").gte("transaction_date", q_start.isoformat()).lte("transaction_date", q_end.isoformat()).eq("user_id", user_id).execute()
        transactions = tx_res.data or []
        
        total_income = 0.0
        total_expense = 0.0
        category_spends: dict[str, float] = {}
        category_monthly_spends: dict[str, dict[int, float]] = {} # cat_id -> {month: amount}
        
        net_tx_change = 0.0
        
        for tx in transactions:
            amt = float(tx.get("amount", 0))
            tx_type = tx.get("type")
            tx_date_str = tx.get("transaction_date", "")
            if not tx_date_str: continue
            tx_month = datetime.fromisoformat(tx_date_str.replace("Z", "+00:00")).month
            
            if tx_type == "income":
                total_income += amt
                net_tx_change += amt
            elif tx_type == "expense":
                total_expense += amt
                net_tx_change -= amt
                cat_id = tx.get("category_id")
                if cat_id:
                    category_spends[cat_id] = category_spends.get(cat_id, 0.0) + amt
                    if cat_id not in category_monthly_spends:
                        category_monthly_spends[cat_id] = {}
                    category_monthly_spends[cat_id][tx_month] = category_monthly_spends[cat_id].get(tx_month, 0.0) + amt
                    
            # Note: transfers are excluded from total_income and total_expense, and they cancel out in overall net change.
            
        # 3. Fetch wallets to get current balance and reconstruct
        wallets_res = await self._db.table("wallets").select("balance").eq("user_id", user_id).execute()
        wallets = wallets_res.data or []
        ending_balance = sum(float(w.get("balance", 0)) for w in wallets)
        
        # To reconstruct starting balance:
        # We need the net change from the START of the quarter to NOW.
        # Wait, if we are computing this for a past quarter, the "current" balance is now, 
        # but we need to subtract ALL net changes from quarter_start up to NOW.
        # This requires querying all transactions >= quarter_start.
        today = datetime.now(timezone.utc).date()
        tx_all_res = await self._db.table("transactions").select("amount, type").gte("transaction_date", q_start.isoformat()).lte("transaction_date", today.isoformat()).eq("user_id", user_id).execute()
        all_tx_since_start = tx_all_res.data or []
        
        net_change_since_start = 0.0
        for tx in all_tx_since_start:
            amt = float(tx.get("amount", 0))
            tx_type = tx.get("type")
            if tx_type == "income":
                net_change_since_start += amt
            elif tx_type == "expense":
                net_change_since_start -= amt
                
        starting_balance = ending_balance - net_change_since_start
        # Then ending_balance for the quarter is starting_balance + net_tx_change
        # (This is true if the quarter is in the past. If it's the current quarter, ending_balance_for_q is just current balance).
        ending_balance_for_q = starting_balance + net_tx_change
        
        # 4. Fetch Categories for Overspend calculation
        cats_res = await self._db.table("categories").select("id, name, monthly_limit, deleted_at").eq("user_id", user_id).execute()
        categories = cats_res.data or []
        
        spending_by_category_list = []
        for cat in categories:
            cat_id = cat["id"]
            if cat_id not in category_spends: continue
            
            # If deleted, treat limit as None
            limit = float(cat.get("monthly_limit") or 0)
            if cat.get("deleted_at"):
                limit = 0.0
                
            overspend_months = 0
            if limit > 0:
                for month, spend in category_monthly_spends.get(cat_id, {}).items():
                    if spend > limit:
                        overspend_months += 1
                        
            spending_by_category_list.append({
                "category_id": cat_id,
                "category_name": cat["name"],
                "total_spend": category_spends[cat_id],
                "overspend_months_count": overspend_months
            })
            
        # 5. Fetch Daily Survival for Streak and Zero-Spend
        survival_res = await self._db.table("journey_daily_survival").select("tracking_date, status, zero_spend_xp_claimed").gte("tracking_date", q_start.isoformat()).lte("tracking_date", q_end.isoformat()).eq("user_id", user_id).order("tracking_date").execute()
        survival_data = survival_res.data or []
        
        zero_spend_days = 0
        longest_streak = 0
        current_streak = 0
        
        for day in survival_data:
            if day.get("zero_spend_xp_claimed"):
                zero_spend_days += 1
                
            status = day.get("status")
            if status in ("SAFE_LOGGED", "SAFE_CLAIMED"):
                current_streak += 1
                if current_streak > longest_streak:
                    longest_streak = current_streak
            else:
                current_streak = 0
                
        # 6. Fetch Challenges
        from ..challenge_templates import get_template
        challenges_res = await self._db.table("journey_challenges").select("id, template_id, status").gte("started_at", q_start.isoformat()).lte("started_at", q_end.isoformat()).eq("user_id", user_id).execute()
        challenges_data = challenges_res.data or []
        
        challenges_summary = []
        for ch in challenges_data:
            t_id = ch.get("template_id", "")
            try:
                template = get_template(t_id)
                challenges_summary.append({
                    "id": ch["id"],
                    "template_id": t_id,
                    "title": template.title,
                    "description": template.description,
                    "icon": template.icon,
                    "achieved": ch.get("status") == "COMPLETED"
                })
            except KeyError:
                pass
                
        now_str = datetime.now(timezone.utc).isoformat()
        
        report_data = {
            "user_id": user_id,
            "quarter": quarter,
            "year": year,
            "quarter_start": q_start.isoformat(),
            "quarter_end": q_end.isoformat(),
            "is_partial": is_partial,
            "longest_streak": longest_streak,
            "zero_spend_days": zero_spend_days,
            "total_income": total_income,
            "total_expenses": total_expense,
            "net_change": net_tx_change,
            "starting_wallet_balance": starting_balance,
            "ending_wallet_balance": ending_balance_for_q,
            "challenges_summary": challenges_summary,
            "spending_by_category": spending_by_category_list,
            "wallet_breakdown": [],
            "computed_at": now_str
        }
        
        # 7. Upsert to journey_quarterly_reports
        # Supabase Python client upsert:
        res = await self._db.table("journey_quarterly_reports").upsert(
            report_data, 
            on_conflict="user_id, quarter, year"
        ).execute()
        
        if not res.data:
            return report_data
        return res.data[0]
