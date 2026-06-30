# Frontend Architecture & Structure

This document provides a concise overview of the FinJourney frontend structure for AI agents to understand the setup with minimal token usage.

## Core Tech Stack
- **Framework**: Next.js (App Router)
- **UI Library**: React
- **Styling**: Tailwind CSS v4 + Radix UI Primitives + Framer Motion
- **State Management**: Zustand (Local State) + TanStack React Query (Server State Cache)
- **Authentication**: Supabase SSR (`@supabase/ssr`)
- **Forms**: React Hook Form + Zod

## Directory Structure (`src/`)
- `app/`: Next.js App Router structure.
  - `(main)/`: Public-facing pages (marketing, news, pricing).
  - `(minimal)/`: The core authenticated application (`analytics`, `auth`, `dashboard`, `finance`, `journey`, `onboarding`, `settings`, `wallets`). Uses a minimal shell/sidebar layout.
  - `api/`: Next.js API routes (if any) or proxy configuration.
- `components/`: React components grouped by feature domain.
  - `ui/`: Generic, reusable, dumb components (Buttons, Inputs, Dialogs).
  - `analytics/`, `auth/`, `dashboard/`, `finance/`, `journey/`, `onboarding/`, `settings/`, `wallets/`: Feature-specific compound components. Note that `settings/` contains the UI toggles for the gamification email system.
- `lib/`: Utilities and API client wrappers.
  - `apiClient.client.ts`: Wrapper for `fetch` used in React Client Components (e.g., inside TanStack Query). Passes Supabase JWT to the backend.
  - `apiClient.server.ts`: Wrapper for `fetch` used in React Server Components.

## API & Data Fetching Strategy (Consistency & Integrity)
To ensure seamless integration and reliable communication with the backend:
1. **The Proxy Rewrite**: In `next.config.ts`, any request to `/api/v1/*` is proxied to `http://127.0.0.1:8000/api/v1/*` (the FastAPI backend).
2. **API Client & Authentication**: All client-side requests MUST use `apiFetchClient` from `lib/apiClient.client.ts`. It automatically attaches the active Supabase JWT Bearer token to requests so FastAPI can authenticate the user. Do not use raw `fetch` for authenticated endpoints.
3. **Server State Management**: Use **TanStack React Query** (`useQuery`, `useMutation`) for fetching, caching, and mutating remote data.
4. **Type Safety**: Define TypeScript interfaces or Zod schemas for all API requests and responses. These must strictly map to the Pydantic schemas defined in the backend to ensure data integrity across the stack.
5. **Error Handling**: Mutations and queries should appropriately catch errors. Display meaningful feedback (e.g., toast notifications) for failures leveraging the standardized error responses returned by the FastAPI backend.
6. **Zustand**: Reserved for global UI state (e.g., sidebar toggles, theme preferences) that does not need to synchronize with the database.

## Styling Guidelines
- **Tailwind v4**: We use the latest Tailwind v4 syntax.
- **Utility Functions**: Use `clsx` and `tailwind-merge` (often wrapped in a `cn()` function in `lib/utils.ts`) when composing class names to avoid specificity clashes.
- **Radix UI**: Complex interactive components (Tabs, Dialogs, Tooltips, Accordions) should be built on top of Radix UI primitives for accessibility.
- **Animations**: `framer-motion` is used for micro-interactions and page transitions.
