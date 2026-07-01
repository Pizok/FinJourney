# FinJourney 🗡️💰
**Note:** The backend is hosted on Render's free plan, which spins down after inactivity. Expect a 50+ second cold start on the first request.

## 🚀 Recent Updates

*Note: After the deployment & submission, I noticed some features needed more refinement. These updates were added to improve the overall experience.*

### 🧭 Onboarding
* **Dashboard Redirect Fix**: Resolved an issue where users were not correctly redirected to the dashboard after completing the onboarding flow.

### 💸 Transactions
* **Cleaner Saving & Loan Payment Records**: Savings contributions and loan repayments are now handled more cleanly as internal transfers, preventing them from incorrectly appearing in spending reports.

### 📊 Analytics & Insight Engine
* **Dynamic Overspending Advisory**: The Analytics page now calculates and flags overspent categories dynamically, with inline breakdowns and direct "Adjust Limit" quick actions.
* **Refined Expense Reporting**: Internal structural transfers (loan repayments, savings contributions) are now explicitly excluded from the "Top Expenses" report, providing a truer picture of disposable spending.

### 🎮 Dashboard
* **Contextual Tooltips**: Added hover tooltips to clarify game mechanics — an info icon next to *Standby Tokens* in the sidebar, and an *About Zero-Spend* tooltip below the claim button.
* **Recent Activity Limit**: The Recent Activity feed is now capped at 8 entries for a cleaner view.

### 🔧 Bug Fixes
* **Journey History List**: The journey event history now correctly loads and displays data from the database.
* **Validation Errors**: Fixed backend validation errors for transactions with uncategorized entries and savings targets with progress exceeding 100%.

---

**FinJourney** is a gamified personal finance management application that turns budgeting, saving, and expense tracking into an RPG-like experience. By blending real-world financial habits with game mechanics, FinJourney motivates users to achieve their financial goals through quests, level progressions, and rewarding good financial behavior with Experience Points (XP) while punishing poor habits by depleting Health Points (HP).

---

## 🌟 Key Features

### 1. Authentication & Onboarding
* **Secure Login**: Powered by Supabase Auth for seamless user sessions.
* **RPG Character Setup**: During onboarding, users select their financial "Path" (e.g., Sentinel, Catalyst, Phantom) and Avatar to represent their journey.
* **Financial Baselines**: Users establish their monthly income, fixed costs, and primary savings targets to calibrate the game's difficulty and tracking.

### 2. Core Finance Management
* **Multi-Wallet System**: Manage different sources of funds including Cash, Bank Accounts, Credit Cards, and Savings.
* **Transaction Tracking**: Log daily incomes and expenses categorized for detailed tracking.
* **Savings Targets**: Create and track priority-based financial goals with specific deadlines.
* **Fixed Expenses & Loans**: Manage recurring monthly bills and track loan repayments.
* **Financial Analytics**: View insightful breakdowns of spending habits and overall financial health.

### 3. Gamification Engine (The Journey)
* **HP & XP Mechanics**: Gain XP (Experience Points) and level up for positive habits (like saving and logging transactions). Lose HP (Health Points) for failing to meet budgets.
* **Daily Survival**: Claim rewards for "Zero-Spend" days or consistent daily financial tracking.
* **Challenges & Quests**: Participate in time-bound challenges to earn extra gold and items.
* **Inventory & Rewards**: Unlock new visual themes, avatars, and defensive "shields" to protect your HP.
* **Regions & Map Progression**: Advance through different financial "regions" as your net worth and level grow.


---


## 🛠️ Tech Stack & Architecture

FinJourney uses a modern, separated architecture with a Next.js frontend and a FastAPI backend, both co-located in the same repository.

### Frontend
* **[Next.js (App Router)](https://nextjs.org/)**: The core React framework handling routing, Server Components, and the main application shell.
* **[React 19](https://react.dev/)**: For building interactive user interfaces.
* **[Tailwind CSS v4](https://tailwindcss.com/)**: Utility-first CSS framework for rapid, custom styling without leaving the markup.
* **[Radix UI](https://www.radix-ui.com/)**: Unstyled, accessible component primitives used to build complex interactive elements (Dialogs, Tabs, etc.).
* **[Framer Motion](https://www.framer.com/motion/)**: Powers smooth micro-interactions, page transitions, and game-like UI feedback.
* **[TanStack React Query](https://tanstack.com/query/latest)**: Manages server state, data fetching, caching, and synchronization with the FastAPI backend.
* **[Zustand](https://zustand-demo.pmnd.rs/)**: Lightweight local state management for UI-specific state (like sidebar toggles).
* **[Supabase SSR](https://supabase.com/docs/guides/auth/server-side-rendering)**: Handles secure, server-side compatible authentication.
* **[React Hook Form](https://react-hook-form.com/) + [Zod](https://zod.dev/)**: For robust, type-safe form validation and submission.

### Backend
* **[FastAPI (Python 3)](https://fastapi.tiangolo.com/)**: High-performance backend framework handling core business logic, the gamification engine, and financial calculations.
* **[Pydantic](https://docs.pydantic.dev/)**: Enforces strict data validation and serialization for API requests and responses.
* **[Supabase (PostgreSQL)](https://supabase.com/)**: The primary database storing user profiles, transactions, and gamification states.
* **[Resend & Jinja2](https://resend.com/)**: Powers the dynamic HTML transactional email system for gamification alerts.
* **[Upstash QStash](https://upstash.com/docs/qstash)**: Handles timezone-aware, robust background job scheduling (like midnight evaluations and evening reminders).

---

## 📂 Project Structure

```text
FinJourney/
├── src/
│   ├── app/
│   │   ├── (main)/          # Public marketing & landing pages
│   │   ├── (minimal)/       # Authenticated app (Dashboard, Finance, Journey)
│   │   ├── api/             # FastAPI backend source code (Python)
│   │   ├── core/            # FastAPI core configs and security
│   │   ├── db/              # Database models and Supabase client
│   │   ├── journey/         # Gamification backend endpoints
│   │   ├── schemas/         # Pydantic models for API
│   │   ├── services/        # Python backend services (email, cron, sync)
│   │   ├── templates/       # Jinja2 email templates
│   │   └── main.py          # FastAPI application entry point
│   ├── components/          # Reusable React components grouped by feature
│   │   ├── dashboard/       # Dashboard & Overview components
│   │   ├── finance/         # Transactions, Wallets, Analytics components
│   │   ├── journey/         # Gamification, Quests, and XP UI
│   │   └── ui/              # Generic Radix/Tailwind components
│   └── lib/                 # Shared utilities and API client wrappers
├── prd/                     # Product Requirements & Documentation
├── supabase/                # Supabase migrations and configs
└── README.md                # General project readme
```
