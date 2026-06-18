import { CurrentChallengeCard } from '../cards/CurrentChallengeCard';
import { ProfileVitalsCard } from '../cards/ProfileVitalsCard';
import { FinancialSituationCard } from '../cards/FinancialSituationCard';
import { DailyBudgetCard } from '../cards/DailyBudgetCard';
import { RecentLogCard } from '../cards/RecentLogCard';
import { QuickActionCard } from '../cards/QuickActionCard';

/**
 * Three-row asymmetric grid — 12 columns, gap-6.
 *
 * Row 1 (Progression):  CurrentChallenge 8 | ProfileVitals 4
 * Row 2 (Financial):    FinancialSituation 5 | DailyBudget 7
 * Row 3 (Actions):      RecentLog 7 | QuickAction 5
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

      {/* Row 2 — Financial State */}
      <div className="col-span-12 lg:col-span-5">
        <FinancialSituationCard />
      </div>
      <div className="col-span-12 lg:col-span-7">
        <DailyBudgetCard />
      </div>

      {/* Row 3 — Actions */}
      <div className="col-span-12 lg:col-span-7">
        <RecentLogCard />
      </div>
      <div className="col-span-12 lg:col-span-5">
        <QuickActionCard />
      </div>
    </div>
  );
}
