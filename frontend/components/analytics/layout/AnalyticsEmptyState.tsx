import { BarChart3 } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

export function AnalyticsEmptyState() {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-tactical-border/50 py-24 px-6 text-center">
      <div className="mb-4 rounded-full bg-tactical-border/20 p-4">
        <BarChart3 size={40} className="text-muted-emerald" />
      </div>
      <h3 className="mb-2 font-display text-2xl font-semibold text-pearl-text">
        Start tracking to unlock insights
      </h3>
      <p className="mb-8 max-w-md text-sm text-muted-text leading-relaxed">
        We need a little more data to analyze your financial health. Add your recent transactions in the Finance tab to see cashflow trends and personalized advisory.
      </p>
      <Link
        href="/finance"
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-6 py-2.5 text-sm font-medium",
          "bg-muted-emerald text-white hover:bg-emerald-600 transition-colors"
        )}
      >
        Go to Finance
      </Link>
    </div>
  );
}
