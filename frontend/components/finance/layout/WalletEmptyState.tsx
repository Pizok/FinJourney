import { Plus } from "lucide-react";
import { useWalletStore } from "@/components/finance/stores/walletStore";
import { cn } from "@/lib/utils";

export function WalletEmptyState() {
  const { setUI } = useWalletStore();

  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-tactical-border/50 py-16 px-6 text-center">
      <div className="mb-4 rounded-full bg-tactical-border/20 p-4">
        <Plus size={32} className="text-muted-emerald" />
      </div>
      <h3 className="mb-2 font-display text-lg font-semibold text-pearl-text">
        No wallets yet
      </h3>
      <p className="mb-6 max-w-sm text-sm text-muted-text">
        Add your first wallet to start tracking your balances, budgets, and transactions.
      </p>
      <button
        type="button"
        onClick={() => setUI("isCreateWalletOpen", true)}
        className={cn(
          "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium",
          "bg-muted-emerald text-white hover:bg-emerald-600 transition-colors"
        )}
      >
        <Plus size={16} />
        Add wallet
      </button>
    </div>
  );
}
