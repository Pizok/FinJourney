"""
app/services/email_svc.py

Resend email service for FinJourney transactional emails.

All send functions are async and fire-and-forget safe:
  - Errors are caught internally and logged as WARNING.
  - Callers never receive an exception from this module.
  - If RESEND_API_KEY is empty, sends are skipped (no crash).

Templates are rendered via Jinja2 from app/templates/.
Each send_*() function receives typed, named arguments so callers
are never constructing raw template dicts.
"""
from __future__ import annotations

import logging
from pathlib import Path

logger = logging.getLogger(__name__)

# -- Lazy imports: resend and jinja2 optional at import time ------------------
# Missing dependency does not crash the server at startup; emails silently no-op.

try:
    import resend as _resend_sdk
    _RESEND_AVAILABLE = True
except ImportError:
    _RESEND_AVAILABLE = False
    logger.warning("email_svc: 'resend' package not installed -- all email sends disabled.")

try:
    from jinja2 import Environment, FileSystemLoader, select_autoescape
    _JINJA2_AVAILABLE = True
except ImportError:
    _JINJA2_AVAILABLE = False
    logger.warning("email_svc: 'jinja2' package not installed -- all email sends disabled.")


# -- Jinja2 environment -------------------------------------------------------

_TEMPLATE_DIR = Path(__file__).parent.parent / "templates"

_jinja_env = None


def _get_jinja_env():
    global _jinja_env
    if _jinja_env is None and _JINJA2_AVAILABLE:
        _jinja_env = Environment(
            loader=FileSystemLoader(str(_TEMPLATE_DIR)),
            autoescape=select_autoescape(["html"]),
        )
    return _jinja_env


def _render(template_name: str, **context) -> str | None:
    """Renders a Jinja2 template. Returns None on any failure."""
    try:
        env = _get_jinja_env()
        if env is None:
            return None
        tmpl = env.get_template(template_name)
        return tmpl.render(**context)
    except Exception as exc:
        logger.warning("email_svc._render: failed to render '%s' -- %s", template_name, exc)
        return None


# -- Core send primitive ------------------------------------------------------

def _init_resend() -> bool:
    """
    Initialises the Resend client with the API key from config.
    Returns False if the key is missing or the SDK is unavailable.
    """
    if not _RESEND_AVAILABLE:
        return False
    from app.core.config import settings
    api_key = settings.resend_api_key
    if not api_key:
        logger.debug("email_svc: RESEND_API_KEY not set -- email send skipped.")
        return False
    _resend_sdk.api_key = api_key
    return True


def _send_email(*, to: str, subject: str, html: str) -> None:
    """
    Fires a single email via Resend. Synchronous wrapper called inside async
    send functions. Errors are swallowed and logged; never re-raised.
    """
    try:
        if not _init_resend():
            return
        from app.core.config import settings
        params = {
            "from": settings.resend_from_email,
            "to": [to],
            "subject": subject,
            "html": html,
        }
        result = _resend_sdk.Emails.send(params)
        logger.info("email_svc: sent '%s' to=%s id=%s", subject, to, result.get("id", "?"))
    except Exception as exc:
        logger.warning("email_svc: Resend send failed to=%s subject='%s' -- %s", to, subject, exc)


# -- Public send functions -----------------------------------------------------


async def send_daily_reminder(
    *,
    to: str,
    username: str,
    daily_budget: int,
    streak: int,
) -> None:
    """
    Sends the 20:00 daily reminder email to a user who has not logged any
    activity today and is at risk of a Ghost Penalty at midnight.
    """
    from app.core.config import settings
    html = _render(
        "daily_reminder.html",
        username=username,
        daily_budget=f"Rp {daily_budget:,}".replace(",", "."),
        streak=streak,
        app_url=settings.app_url,
    )
    if html:
        _send_email(
            to=to,
            subject="Do not forget to log today -- Ghost Penalty is coming",
            html=html,
        )


async def send_hazard_alert(
    *,
    to: str,
    username: str,
    current_hp: int,
    source_event: str = "OVERSPEND_DETECTED",
) -> None:
    """
    Sends a hazard alert email when HP drops into the HAZARD zone (<=30)
    or when a Ghost Penalty is applied.
    """
    from app.core.config import settings

    cause_map = {
        "GHOST_PENALTY": "no activity was logged yesterday",
        "OVERSPEND_DETECTED": "you spent over your daily budget",
    }
    cause = cause_map.get(source_event, "recent spending activity")

    html = _render(
        "hazard_alert.html",
        username=username,
        current_hp=current_hp,
        cause=cause,
        app_url=settings.app_url,
    )
    if html:
        subject = (
            f"HP Critical: {current_hp}/100 -- Your account needs immediate attention"
            if current_hp <= 10
            else f"HP Low: {current_hp}/100 -- Take action to recover"
        )
        _send_email(to=to, subject=subject, html=html)


async def send_achievement(
    *,
    to: str,
    username: str,
    achievement_type: str,
    details: dict,
) -> None:
    """
    Sends a single achievement email covering LEVEL_UP, REGION_SHIFT_COMPLETED,
    QUARTER_COMPLETED, and PASSPORT_STAMP_EARNED via one adaptive template.

    achievement_type: "level_up" | "region" | "quarter" | "stamp"
    details: dict of template-specific variables (new_level, region_name, etc.)
    """
    from app.core.config import settings

    subject_map = {
        "level_up": f"Level {details.get('new_level', '?')} reached -- you leveled up!",
        "region": f"New region unlocked: {details.get('region_name', 'Unknown')}",
        "quarter": "Quarter complete -- Boss defeated!",
        "stamp": f"Passport stamp earned: {details.get('region_name', 'Unknown')}",
    }
    subject = subject_map.get(achievement_type, "Achievement unlocked in FinJourney!")

    html = _render(
        "achievement.html",
        username=username,
        achievement_type=achievement_type,
        details=details,
        app_url=settings.app_url,
    )
    if html:
        _send_email(to=to, subject=subject, html=html)


# -- Stub send functions (templates to be designed by user) -------------------

async def send_ghost_penalty(
    *,
    to: str,
    username: str,
    hp_lost: int,
    current_hp: int,
) -> None:
    """
    Stub -- ghost_penalty.html template not yet designed.
    Falls back to send_hazard_alert() until the dedicated template is ready.
    """
    await send_hazard_alert(
        to=to,
        username=username,
        current_hp=current_hp,
        source_event="GHOST_PENALTY",
    )


async def send_passport_stamp(
    *,
    to: str,
    username: str,
    region_name: str,
    stamp_description: str = "",
) -> None:
    """
    Stub -- passport_stamp.html template not yet designed.
    Falls back to send_achievement() until the dedicated template is ready.
    """
    await send_achievement(
        to=to,
        username=username,
        achievement_type="stamp",
        details={"region_name": region_name, "description": stamp_description},
    )
