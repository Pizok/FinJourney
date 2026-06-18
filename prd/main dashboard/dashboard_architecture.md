# Dashboard Architecture & Components — FinJourney

## App Structure
The Dashboard page exists inside `app/(minimal)` and does not use the marketing layout.

## Recommended Folder Structure
```text
components/
└── dashboard/
    ├── layout/
    │   ├── DashboardShell.tsx
    │   ├── DashboardSidebar.tsx
    │   └── DashboardGrid.tsx
    │
    ├── cards/
    │   ├── CurrentChallengeCard.tsx
    │   ├── ProfileVitalsCard.tsx
    │   ├── FinancialSituationCard.tsx
    │   ├── DailyBudgetCard.tsx
    │   ├── RecentLogCard.tsx
    │   └── QuickActionCard.tsx
    │
    ├── modals/
    │   ├── AddTransactionModal.tsx
    │   ├── WelcomeModal.tsx
    │   ├── TutorialModal.tsx
    │   ├── DangerModal.tsx
    │   └── NotificationModal.tsx
    │
    ├── hooks/
    │   ├── useDashboardData.ts
    │   ├── useDashboardModals.ts
    │   └── useTransactionModal.ts
    │
    ├── stores/
    │   └── dashboardStore.ts
    │
    ├── types/
    │   └── dashboard.types.ts
    │
    └── utils/
        └── dashboard.helpers.ts
```

## Tech Stack & State Management

**State Management:**
* Use `Zustand` for global state. Avoid deeply nested prop drilling.

**Data Fetching:**
* Use `TanStack Query` for caching, retries, invalidation, and optimistic updates.
* **Rule:** Avoid global real-time subscriptions. Rely on targeted refresh and lightweight invalidation.

**Form Handling:**
* Use `React Hook Form` combined with `Zod` validation.

---

## UI Library & Styling

**Component System:**
* Must use a custom FinJourney component system built on top of `shadcn` primitives.
* Examples: Customized Dialog, Sheet, Dropdown Menu, Tooltip, Skeleton, Toast.
* **Rule:** All components must follow FinJourney design tokens. Avoid default `shadcn` styling or raw unstyled components.

**Styling:**
* Use `Tailwind CSS`.
* **Rule:** Token-based colors only. No inline hardcoded colors.

**Animation:**
* `Framer Motion` is allowed for minimal usage only (e.g., smooth progress bars or fade-ins).

---

## Accessibility
* Must be keyboard navigable.
* Modals require a focus trap and ESC close support.
* Must include reduced motion compatibility.
* Ensure large tap targets and readable contrast ratios.