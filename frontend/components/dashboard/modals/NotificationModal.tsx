'use client';

import { Bell, X } from 'lucide-react';

interface NotificationModalProps {
  onClose: () => void;
}

/**
 * Shell for system-level notifications pushed from the backend.
 *
 * Currently renders a static placeholder. Wire up to a notifications
 * endpoint or a real-time channel once that table is implemented.
 * The content (title, body, CTA) should be injected from the API payload.
 */
export function NotificationModal({ onClose }: NotificationModalProps) {
  return (
    <div className="bg-canvas-surface border border-tactical-border rounded-xl p-8 w-full max-w-lg shadow-xl animate-fade-in">
      {/* Header row */}
      <div className="flex items-start justify-between gap-4 mb-6">
        <div className="w-10 h-10 rounded-lg bg-abyssal-slate border border-tactical-border flex items-center justify-center flex-shrink-0">
          <Bell size={18} strokeWidth={2} className="text-muted-text" />
        </div>
        <button
          onClick={onClose}
          className="text-muted-text hover:text-pearl-text transition-colors mt-1 flex-shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-border rounded"
          type="button"
          aria-label="Dismiss notification"
        >
          <X size={16} strokeWidth={2} />
        </button>
      </div>

      {/* Placeholder content — swap with API-driven payload */}
      <h2 className="font-display text-lg font-semibold text-pearl-text mb-3">
        System Notification
      </h2>

      <p className="font-sans text-sm text-muted-text leading-relaxed mb-8">
        {/* TODO: Render notification.message from backend payload */}
        A system event requires your attention.
      </p>

      {/* Dismiss CTA */}
      <button
        onClick={onClose}
        className="w-full flex items-center justify-center px-4 py-3 rounded-lg bg-transparent border border-tactical-border text-pearl-text font-sans text-sm font-medium transition-colors hover:border-pearl-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-tactical-border focus-visible:ring-offset-2 focus-visible:ring-offset-canvas-surface"
        type="button"
      >
        Dismiss
      </button>
    </div>
  );
}
