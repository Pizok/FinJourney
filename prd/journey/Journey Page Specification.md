# Journey Page Specification

**register:** state_flow_spec
**target:** Next.js Frontend / Tailwind CSS / TanStack Query

---

# 1. Purpose

The Journey page is the long-term progression hub of FinJourney.

Unlike the Dashboard, which focuses on today's decisions and immediate actions, the Journey page focuses on:

* Progress over time
* Region exploration
* Quarterly Reviews
* Historical achievements
* Milestones
* Financial story progression

The page answers:

> "How far have I come?"

rather than:

> "What should I do today?"

---

# 2. Page Hierarchy

The Journey page is divided into five vertical sections.

```text
Journey Header
────────────────────────────

Region Overview

────────────────────────────

Journey Timeline

────────────────────────────

Quarterly Reviews

────────────────────────────

Passport & Achievements

────────────────────────────

Journey History
```

The page is designed for scrolling exploration rather than daily utility.

---

# 3. State Flow

## 3.1 Initial Load

Page Entry

↓

GET /api/v1/journey/overview

↓

Loading Skeleton

↓

Success

↓

Render Journey Page

---

## 3.2 Region Exploration Flow

User Clicks Region Node

↓

Open Region Detail Modal

↓

GET /api/v1/journey/regions/{region_id}

↓

Display:

* Region Artwork
* Region Description
* Dates Entered
* Days Spent
* Milestones Earned

---

## 3.3 Quarterly Review Flow

User Clicks Review Card

↓

Open Review Detail Modal

↓

GET /api/v1/journey/reviews/{review_id}

↓

Display:

* Objectives
* Completion Status
* Rewards
* Failure Penalties
* Journal Entries

---

## 3.4 Passport Flow

User Clicks Passport Stamp

↓

Open Passport Detail Modal

↓

Display:

* Region Name
* Date Earned
* Related Challenge
* Historical Snapshot

---

## 3.5 Journey History Flow

User Scrolls History

↓

Infinite Pagination

↓

GET /api/v1/journey/history?page=N

↓

Append New Events

---

# 4. Data Contract

## Primary Hydration Endpoint

GET /api/v1/journey/overview

Returns all summary data required to render the page.

```json
{
  "current_region": {
    "id": "quiet_valley",
    "name": "The Quiet Valley",
    "progress_days": 273,
    "total_days": 365,
    "days_remaining": 92
  },

  "journey_progress": {
    "account_days": 273,
    "next_milestone_days": 17,
    "completed_regions": 2
  },

  "active_review": {
    "id": "review_3",
    "type": "savings_fortress",
    "title": "Build the Fortress",
    "status": "active",
    "days_remaining": 12,
    "completion_percentage": 45
  },

  "passport": {
    "stamps_earned": 3,
    "total_available": 12
  },

  "recent_events": [
    {
      "id": "evt_1",
      "type": "achievement",
      "title": "Stayed Under Budget",
      "date": "2026-06-01"
    }
  ]
}
```

---

# 5. Component Map

## JourneyPage

Root page component.

Responsibilities:

* Hydration
* Section composition
* Modal coordination

Children:

```text
JourneyPage
│
├── JourneyHeader
├── RegionOverview
├── TimelineSection
├── QuarterlyReviewSection
├── PassportSection
├── HistorySection
│
├── RegionDetailModal
├── ReviewDetailModal
└── PassportModal
```

---

## JourneyHeader

Purpose:

High-level progress summary.

Content:

* Current Region
* Account Age
* Progress %
* Next Milestone

---

## RegionOverview

Purpose:

Display current region status.

Content:

* Region Artwork
* Region Description
* Current Progress
* Region Shift Countdown

Actions:

* View Region Details

---

## TimelineSection

Purpose:

Visual representation of the 365-day cycle.

Content:

* Region Nodes
* Quarterly Nodes
* Current Position
* Future Milestones

States:

* Completed
* Current
* Locked

---

## QuarterlyReviewSection

Purpose:

Display all quarterly reviews.

Content:

* Current Review
* Past Reviews
* Completion Status

States:

* Upcoming
* Active
* Completed
* Failed

Actions:

* Open Review Detail

---

## PassportSection

Purpose:

Display collectible progression artifacts.

Content:

* Passport Stamps
* Achievement Badges
* Region Completions

Actions:

* Open Stamp Details

---

## HistorySection

Purpose:

Financial story log.

Content:

* Events
* Achievements
* Hazards
* Recoveries
* Region Changes

Behavior:

Infinite Scroll

---

# 6. Loading States

## Page Load

Display:

* Region Skeleton
* Timeline Skeleton
* Review Skeleton

No layout shifting allowed.

---

## Modal Load

Display localized skeletons.

Never block the page.

---

# 7. Empty States

## New User

Region:

"Your journey begins with your first transaction."

Timeline:

"No milestones yet."

Passport:

"No stamps earned."

History:

"No story recorded."

Quarterly Reviews:

"Your first review is being prepared."

---

# 8. Error States

Page Error

Message:

"Unable to load journey."

Action:

[ Retry ]

Modal Error

Message:

"Unable to load details."

Action:

[ Retry ]

---

# 9. Cache & Query Strategy

TanStack Query

Primary Query:

['journey', 'overview']

staleTime:

60 seconds

Invalidate On:

* Region Completion
* Review Completion
* Review Failure
* Passport Earned
* Window Refocus

No polling allowed.

---

# 10. Server Authority Rules

Frontend must never calculate:

* Region completion
* Milestone completion
* Passport eligibility
* Review status
* Journey progress

Frontend only renders server-provided states.

All progression logic remains backend-authoritative.
