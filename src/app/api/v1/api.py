"""
app/api/v1/api.py
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
Central API router for version 1 of the FinJourney API.

All live feature routers are imported here by their ACTUAL filename on disk
and included on ``api_router``.  Ghost domains that have no backing .py file
are commented out with a TODO marker — they must not be imported.

Mounting convention
───────────────────
``api_router`` is mounted at ``/api/v1`` in the root FastAPI application.

``journey_router`` carries its own full prefix (``/api/v1/journey``) and
**must be mounted directly on the app** — NOT inside ``api_router`` — to
avoid a double-prefix collision of the form ``/api/v1/api/v1/journey/**``:

    # in main.py:
    app.include_router(api_router, prefix="/api/v1")
    app.include_router(journey_router)   # already contains /api/v1/journey

Adding a new router
───────────────────
1. Create ``app/api/v1/<feature>.py`` with a ``router = APIRouter(...)`` object.
2. Import it below under the correct section comment.
3. Call ``api_router.include_router(<feature>.router)``.
4. Remove the corresponding TODO comment from the Ghost domains section.
No other file needs to change.
"""

from fastapi import APIRouter

# ── Live routers — files confirmed on disk ────────────────────────────────
from app.api.v1 import (
    account,              # DELETE /account, GET /account/export
    bootstrap,            # GET /me/bootstrap
    categories,           # CRUD /categories
    daily,                # GET /daily-status, POST /daily/use-standby
    endpoints_analytics,  # GET /analytics/overview + advisory, POST /analytics/simulate-loan
    endpoints_wallets,    # CRUD /wallets, POST /wallets/rebalance-budget
    profile,              # GET /profile, PATCH /profile/setup, PATCH /profile/theme
    settings,             # GET /settings, PATCH /settings/*, POST /settings/path/change
    transactions,         # GET /transactions, POST /transactions, DELETE /transactions/{id}
    endpoints_income,
    endpoints_savings,
)

# ── Journey Engine — isolated spoke with a hardcoded full-path prefix ─────
# Mounted directly on the app in main.py (see Mounting convention above).
from app.journey.router import router as journey_router  # prefix: /api/v1/journey

# ── api_router — every Hub-domain router is registered below ─────────────
api_router = APIRouter()

# Auth, Profile & Bootstrap
api_router.include_router(profile.router)
api_router.include_router(bootstrap.router)
api_router.include_router(account.router)

# Core Finance
api_router.include_router(categories.router)
api_router.include_router(daily.router)
api_router.include_router(transactions.router)
api_router.include_router(endpoints_wallets.router)
from app.api.v1 import loans, fixed_expenses
api_router.include_router(loans.router)
api_router.include_router(fixed_expenses.router)
api_router.include_router(endpoints_income.router)
api_router.include_router(endpoints_savings.router)

# Analytics & Reporting
api_router.include_router(endpoints_analytics.router)

# Settings
api_router.include_router(settings.router)

# ── Ghost domains — no backing file yet ───────────────────────────────────
# Uncomment each entry only once the corresponding endpoint module exists on disk.
# Importing a module that doesn't exist will crash the server at startup.
#
from app.api.v1 import auth
api_router.include_router(auth.router, tags=["auth"])

# from app.api.v1 import adventures
# api_router.include_router(adventures.router)     # TODO: create app/api/v1/adventures.py

# from app.api.v1 import boss
# api_router.include_router(boss.router)           # TODO: create app/api/v1/boss.py

# from app.api.v1 import inventory
# api_router.include_router(inventory.router)      # TODO: create app/api/v1/inventory.py

# (loans router is implemented)

# from app.api.v1 import regions
# api_router.include_router(regions.router)        # TODO: create app/api/v1/regions.py

# from app.api.v1 import shop
# api_router.include_router(shop.router)           # TODO: create app/api/v1/shop.py

# from app.api.v1 import tasks
# api_router.include_router(tasks.router)          # TODO: create app/api/v1/tasks.py
