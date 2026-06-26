import { Compass } from "lucide-react";

export function JourneyEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-tactical-border/50 py-24 px-6 text-center lg:col-span-12">
      <div className="mb-4 rounded-full bg-tactical-border/20 p-4">
        <Compass size={40} className="text-muted-emerald" />
      </div>
      <h3 className="mb-2 font-display text-2xl font-semibold text-pearl-text">
        Your journey begins here
      </h3>
      <p className="max-w-md text-sm text-muted-text leading-relaxed">
        You haven't completed any regions or earned any stamps yet. Log your daily spending and stay under budget to gain XP, unlock regions, and build your financial fortress.
      </p>
    </div>
  );
}
