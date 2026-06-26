# Agent Handoff & Project Guidelines

**Welcome, new AI Agent!**
The user has switched accounts or started a new session. This document contains critical context about the FinJourney project, past mistakes to avoid, and rules for how to communicate with the user. **Read this entirely before suggesting architecture changes.**

---

## 1. Project Structure & Architecture
- **Monorepo Style**: Both the Next.js frontend and the Python FastAPI backend live together inside the `src/` directory. (Note: This used to be called `frontend/`, but was renamed to `src/`. If you see old docs mentioning `frontend/`, treat it as `src/`).
- **Frontend**: Next.js 16 (App Router), React 19, Tailwind CSS v4, Radix UI, Zustand, TanStack Query.
- **Backend**: FastAPI (Python 3), Supabase (PostgreSQL), Pydantic. Located in `src/app/api/v1/` and `src/app/journey/`.
- **The Bridge**: The Next.js app proxies API requests to the backend. In `src/next.config.ts`, `/api/v1/*` is rewritten to `http://127.0.0.1:8000/api/v1/*`. 

---

## 2. CRITICAL Rules (Mistakes to Prevent)

### Do NOT use Vercel for the Python Backend
* **Mistake**: Suggesting the user configure `vercel.json` to run the FastAPI app as Vercel Serverless Functions.
* **Correction**: Vercel kills background tasks and exhausts Supabase database connections. The frontend is deployed to Vercel, but the FastAPI backend MUST be deployed to a persistent server (like Render or Railway). Do not attempt to merge them into a single serverless Vercel deployment.

### The Backend is the ONLY Source of Truth
* **Mistake**: Writing frontend TypeScript logic to calculate HP drops, XP gains, or complex financial analytics.
* **Correction**: The Gamification Engine (XP, HP, Leveling, Shields) and Financial Analytics are extremely complex. The backend calculates everything. The Next.js frontend is strictly a "dumb client" that displays the JSON payloads returned by the backend. 

### Do NOT Break the Transactional Email System
* **Mistake**: Trying to use SMTP, SendGrid, or synchronous email sending.
* **Correction**: We use **Resend** and **Jinja2** templates (located in `src/app/templates/`). Emails must be sent using `src/app/services/email_svc.py` and must **always** be dispatched via FastAPI `BackgroundTasks` so they don't block the API response. 

### Background Jobs (Crons)
* **Mistake**: Suggesting `celery`, `redis`, or `APScheduler` for cron jobs.
* **Correction**: We use **Upstash QStash** to trigger webhooks (like `POST /cron/daily-evaluation` and `POST /cron/evening-reminder`). The backend receives the webhook, returns `202 Accepted` immediately, and does the heavy lifting in a BackgroundTask.

---

## 3. Communication Guidelines with the User

1. **Be Honest and Direct**: If the user asks if something is a good idea (like deploying FastAPI on Vercel), tell them the honest architectural truth. Explain *why* certain decisions are made (e.g., connection pooling, data integrity).
2. **Step-by-Step External Actions**: You cannot control the user's Vercel dashboard, Supabase dashboard, or Upstash console. When a task requires these, provide clear, numbered, step-by-step instructions for the user to follow.
3. **Wait for Servers to Stop**: When making sweeping file changes or renaming folders, remember that the user is on Windows. If they have Next.js or Uvicorn running in their terminal, files will be locked. Remind them to stop their servers before doing major refactors.
4. **Assume High Ambition**: This project is for a major exam/presentation. The design must be premium, the architecture must be sound, and the features must work flawlessly. Do not cut corners.

---

**End of Handoff.** You are ready to assist the user.
