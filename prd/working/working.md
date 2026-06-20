# working.md — Change Log
> Format: `[date] [type] file — note`  
> Types: `ADD` `EDIT` `MOVE` `FIX` `DELETE` `NOTE`

---

## 2026-06-18

`NOTE` `prd/working/` folder created as working area for backend docs & change log.

`ADD` `prd/working/backend_audit.md` — Full integrity audit of `frontend/app/{api,core,db,schemas,services}`. 13 critical bugs + 8 structural issues catalogued with file + line references.

`ADD` `prd/working/backend_map.md` — Complete function registry for all existing `.py` backend files. Lists every fn, schema, and constant. Reference before adding new code to avoid duplication.

`ADD` `prd/working/working.md` — This log file.

---

## Pending / To-Do

- [ ] Fix 13 critical import/alias bugs (see `backend_audit.md` #1–13)
- [ ] Move `schemas/wallet_queries.py` → `db/queries/wallet_queries.py`
- [ ] Move `schemas/category_queries.py` → `db/queries/category_queries.py`
- [ ] Reconcile asyncpg vs Supabase DB strategy (analytics stack)
- [ ] Wire `budget_service.apply_daily_bleed` into `transaction_service`
- [ ] Build missing endpoint files (see `backend_map.md` § Missing Files)
