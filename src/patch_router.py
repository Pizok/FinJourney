import os
import re

path = 'app/journey/router.py'
with open(path, 'r', encoding='utf-8') as f:
    content = f.read()

replacement_func = '''def _today_iso(timezone_str: str = "UTC") -> str:
    try:
        from zoneinfo import ZoneInfo
        tz = ZoneInfo(timezone_str)
    except Exception:
        from datetime import timezone
        tz = timezone.utc
    from datetime import datetime
    return datetime.now(tz).date().isoformat()
'''
content = re.sub(r'_today_iso = lambda: datetime\.now\(timezone\.utc\)\.date\(\)\.isoformat\(\)\s*# noqa: E731', replacement_func, content)

# For endpoint 'get_hub_data'
content = content.replace(
    '    local_date = _today_iso()\n    \n    events_task = db.table("journey_events")',
    '    user_tz = profile.get("timezone", "UTC") if profile else "UTC"\n    local_date = _today_iso(user_tz)\n    \n    events_task = db.table("journey_events")'
)

# For endpoints where we only have user_id, let's fetch profile first if needed, or if it's already there
# Let's inspect where local_date = _today_iso() is used.
