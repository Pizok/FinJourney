import { CurrentChallengeCard } from '../cards/CurrentChallengeCard';
import { ProfileVitalsCard } from '../cards/ProfileVitalsCard';
import { DailyBudgetCard } from '../cards/DailyBudgetCard';
import { RecentLogCard } from '../cards/RecentLogCard';
import { QuickActionCard } from '../cards/QuickActionCard';

/**
 * Asymmetric grid layout.
 *
 * Row 1 (Progression):  CurrentChallenge 8 | ProfileVitals 4
 * Below Row 1:          RecentLog 7 | (DailyBudget + QuickAction) 5
 */
export function DashboardGrid() {
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Row 1 — Progression */}
      <div className="col-span-12 lg:col-span-8">
        <CurrentChallengeCard />
      </div>
      <div className="col-span-12 lg:col-span-4">
        <ProfileVitalsCard />
      </div>

      {/* Main Content Area */}
      
      {/* Left Column — Transactions */}
      <div className="col-span-12 lg:col-span-7">
        <RecentLogCard />
      </div>

      {/* Right Column — Budget & Actions */}
      <div className="col-span-12 lg:col-span-5 flex flex-col gap-6">
        <DailyBudgetCard />
        <QuickActionCard />
      </div>
    </div>
  );
}
