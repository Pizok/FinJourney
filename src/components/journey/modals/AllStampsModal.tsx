import { Modal } from "@/components/ui/Modal";
import { PassportStamp, LockedStamp } from "../types/journey.types";
import { Award, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { StatusBadge } from "@/components/ui/Badge";

export interface AllStampsModalProps {
  isOpen: boolean;
  onClose: () => void;
  stamps: PassportStamp[];
  locked: LockedStamp[];
}

export function AllStampsModal({
  isOpen,
  onClose,
  stamps,
  locked,
}: AllStampsModalProps) {
  return (
    <Modal isOpen={isOpen} onClose={onClose} title="All Achievements" size="md">
      <Modal.Header>
        <div className="flex items-center justify-between">
          <h2 className="font-display text-[19px] font-semibold text-pearl-text tracking-tight">
            All Achievements
          </h2>
          <span className="font-sans text-[13px] text-muted-text bg-tactical-surface px-2 py-1 rounded-md border border-tactical-border/50">
            {stamps.length} / {stamps.length + locked.length} Earned
          </span>
        </div>
      </Modal.Header>

      <Modal.Body className="space-y-4 max-h-[60vh] overflow-y-auto pr-2 custom-scrollbar">
        {/* Render earned stamps first */}
        {stamps.map((stamp) => (
          <div
            key={stamp.id}
            className="flex items-center gap-4 p-4 rounded-xl border border-muted-emerald/20 bg-muted-emerald/5"
          >
            <div
              className="flex shrink-0 items-center justify-center w-12 h-12 rounded-full bg-muted-emerald/10 text-muted-emerald"
              aria-hidden="true"
            >
              <Award size={24} strokeWidth={2} />
            </div>
            <div className="flex flex-col gap-1 min-w-0 flex-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-sans text-[14px] font-bold text-pearl-text truncate">
                  {stamp.title}
                </span>
                <StatusBadge status="completed" />
              </div>
              <span className="font-sans text-[12px] text-muted-text">
                {stamp.requirement}
              </span>
              <span className="font-sans text-[11px] text-muted-emerald/80 mt-1">
                Earned: {stamp.date.split('T')[0]}
              </span>
            </div>
          </div>
        ))}

        {/* Render locked stamps next */}
        {locked.map((slot) => {
          return (
            <div
              key={slot.id}
              className="flex items-center gap-4 p-4 rounded-xl border border-dashed border-tactical-border/40 opacity-60 bg-tactical-surface/20"
            >
              <div
                className="flex shrink-0 items-center justify-center w-12 h-12 rounded-full bg-tactical-surface text-muted-text/50"
                aria-hidden="true"
              >
                <Lock size={20} strokeWidth={2} />
              </div>
              <div className="flex flex-col gap-1 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-sans text-[14px] font-semibold text-pearl-text truncate">
                    {slot.title}
                  </span>
                  <span className="font-sans text-[11px] px-2 py-0.5 rounded-full bg-tactical-surface border border-tactical-border text-muted-text uppercase font-bold tracking-wider">
                    Locked
                  </span>
                </div>
                <span className="font-sans text-[12px] text-muted-text">
                  {slot.requirement}
                </span>
              </div>
            </div>
          );
        })}
      </Modal.Body>
    </Modal>
  );
}
