# Settings Component Map — FinJourney

## Route Structure

```txt
app/(minimal)/settings/page.tsx
```

Settings uses:

* Minimal Application Layout
* Persistent Sidebar
* No Landing Header
* No Landing Footer

Access:

* Available immediately after onboarding
* No level requirement
* Accessible from Sidebar Navigation

---

# Recommended Folder Structure

```txt
app/
└── (minimal)/
    └── settings/
        └── page.tsx

components/
└── settings/
    ├── layout/
    │   ├── SettingsShell.tsx
    │   ├── SettingsSidebar.tsx
    │   ├── SettingsContent.tsx
    │   └── SettingsSection.tsx
    │
    ├── profile/
    │   ├── ProfileCard.tsx
    │   ├── AvatarUploader.tsx
    │   ├── UsernameInput.tsx
    │   ├── EmailDisplay.tsx
    │   ├── TimezoneSelector.tsx
    │   └── PaydaySelector.tsx
    │
    ├── financials/
    │   ├── FinancialBaselinesCard.tsx
    │   ├── MonthlyIncomeInput.tsx
    │   ├── SavingsAllocationInput.tsx
    │   ├── FixedCostSummary.tsx
    │   ├── FixedCostBreakdownButton.tsx
    │   ├── ProjectedBudgetCard.tsx
    │   └── OpenWalletManagerButton.tsx
    │
    ├── progression/
    │   ├── JourneyProgressionCard.tsx
    │   ├── ActivePathCard.tsx
    │   ├── PathCooldownIndicator.tsx
    │   ├── ChangePathButton.tsx
    │   └── ResetProgressButton.tsx
    │
    ├── preferences/
    │   ├── PreferencesCard.tsx
    │   ├── ThemeSelector.tsx
    │   ├── ReducedMotionToggle.tsx
    │   └── PrivacyModeToggle.tsx
    │
    ├── notifications/
    │   ├── NotificationSettingsCard.tsx
    │   ├── DailyReminderToggle.tsx
    │   ├── HazardAlertToggle.tsx
    │   └── AchievementToggle.tsx
    │
    ├── modals/
    │   ├── ChangePathModal.tsx
    │   ├── ResetProgressModal.tsx
    │   └── FixedCostBreakdownModal.tsx
    │
    ├── states/
    │   ├── SettingsSkeleton.tsx
    │   ├── SettingsErrorState.tsx
    │   ├── UnsavedChangesBar.tsx
    │   └── SettingsSuccessToast.tsx
    │
    ├── hooks/
    │   ├── useSettings.ts
    │   ├── useProfileSettings.ts
    │   ├── useFinancialSettings.ts
    │   ├── usePathChange.ts
    │   └── useNotificationSettings.ts
    │
    ├── stores/
    │   └── settingsStore.ts
    │
    └── types/
        └── settings.types.ts
```

---

# Page Structure

```txt
SettingsPage
│
├── SettingsSidebar
│
├── ProfileCard
│    ├── AvatarUploader
│    ├── UsernameInput
│    ├── EmailDisplay
│    ├── TimezoneSelector
│    └── PaydaySelector
│
├── FinancialBaselinesCard
│    ├── MonthlyIncomeInput
│    ├── SavingsAllocationInput
│    ├── FixedCostSummary
│    ├── ProjectedBudgetCard
│    └── OpenWalletManagerButton
│
├── JourneyProgressionCard
│    ├── ActivePathCard
│    ├── PathCooldownIndicator
│    ├── ChangePathButton
│    └── ResetProgressButton
│
├── PreferencesCard
│    ├── ThemeSelector
│    ├── ReducedMotionToggle
│    └── PrivacyModeToggle
│
├── NotificationSettingsCard
│    ├── DailyReminderToggle
│    ├── HazardAlertToggle
│    └── AchievementToggle
│
├── ChangePathModal
├── ResetProgressModal
└── FixedCostBreakdownModal
```

---

# Libraries

Required:

* Zustand
* TanStack Query
* React Hook Form
* Zod
* shadcn/ui
* Sonner

Avoid:

* Enterprise admin settings frameworks
* Multi-step settings wizards
* Heavy profile management systems
* Complex preference engines

```
```
