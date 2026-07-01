import { Compass } from "lucide-react";

export function JourneyEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-tactical-border/50 py-24 px-6 text-center lg:col-span-12">
      <div className="mb-4 rounded-full bg-tactical-border/20 p-4">
        <Compass size={40} className="text-muted-emerald" />
      </div>
      <h3 className="mb-2 font-display text-2xl font-semibold text-pearl-text">
        No history yet
      </h3>
      <p className="max-w-md text-sm text-muted-text leading-relaxed">
        Your journey events, passport stamps, and activity timeline will appear here as you log transactions, stay under budget, and earn XP each day.
      </p>
    </div>
  );
}
