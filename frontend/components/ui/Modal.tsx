"use client";

// =============================================================================
// components/ui/Modal.tsx
//
// Shared modal container primitive. All Journey modals build on top of this.
//
// Responsibilities:
//   - ReactDOM.createPortal to document.body (escapes CSS stacking contexts)
//   - Focus trap: Tab / Shift+Tab cycle within the modal
//   - Focus restoration: returns focus to the triggering element on close
//   - Body scroll lock: prevents page scroll while modal is open
//   - Escape key: delegates to onClose (JourneyPageClient also handles this
//     globally, but Modal handles it locally for defence-in-depth)
//   - Backdrop click: closes the modal
//   - Open/close animation: scale + fade, 200ms cubic-bezier
//   - ARIA: role="dialog", aria-modal, aria-labelledby (auto-generated id)
//
// Sub-components (static properties):
//   Modal.Header  — title row with close button, reads onClose from context
//   Modal.Body    — scrollable content region (max-h + overflow-y-auto)
//   Modal.Footer  — optional action-button row (border-top separator)
//
// Accessibility contract:
//   - Caller must pass a `title` prop — used to generate the aria-labelledby
//     value that announces the modal to screen readers on open.
//   - Content inside Modal.Body should use semantic headings (h2 → h3).
//   - Interactive elements inside must be reachable via keyboard.
//
// Design rules (DESIGN.md §5 "Modals"):
//   - Canvas Surface background (#1E293B)
//   - 1px Tactical Border
//   - rounded-2xl (--radius-2xl = 1.5rem)
//   - Generous padding (p-6 inside sections)
//   - Subtle non-glowing shadow only (shadow-2xl / ring)
//   - No glassmorphism, no outer glow
//   - Backdrop: abyssal-slate at 82% opacity — no backdrop-blur
// =============================================================================

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

// ─── Context ──────────────────────────────────────────────────────────────────

interface ModalContextValue {
  onClose: () => void;
  titleId: string;
}

const ModalContext = createContext<ModalContextValue>({
  onClose: () => {},
  titleId: "",
});

// ─── Focus trap hook ──────────────────────────────────────────────────────────

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

function useFocusTrap(
  ref: React.RefObject<HTMLElement | null>,
  active: boolean
) {
  // Capture the element that triggered the modal open so we can restore focus
  const previousFocusRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!active) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the first focusable element after the enter animation settles
    const focusTimer = setTimeout(() => {
      const container = ref.current;
      if (!container) return;
      const els = container.querySelectorAll<HTMLElement>(FOCUSABLE);
      els[0]?.focus();
    }, 60);

    function handleTab(e: KeyboardEvent) {
      const container = ref.current;
      if (!container || e.key !== "Tab") return;

      const els = Array.from(
        container.querySelectorAll<HTMLElement>(FOCUSABLE)
      ).filter((el) => !el.closest('[aria-hidden="true"]'));

      if (els.length === 0) return;
      const first = els[0];
      const last = els[els.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleTab);

    return () => {
      clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleTab);
      // Restore focus to the element that opened the modal
      previousFocusRef.current?.focus();
    };
  }, [active, ref]);
}

// ─── Scroll lock hook ─────────────────────────────────────────────────────────

function useBodyScrollLock(active: boolean) {
  useEffect(() => {
    if (!active) return;

    // Measure scrollbar width to prevent layout shift when overflow is hidden
    const scrollbarWidth =
      window.innerWidth - document.documentElement.clientWidth;
    const prev = document.body.style.overflow;
    const prevPad = document.body.style.paddingRight;

    document.body.style.overflow = "hidden";
    document.body.style.paddingRight = `${scrollbarWidth}px`;

    return () => {
      document.body.style.overflow = prev;
      document.body.style.paddingRight = prevPad;
    };
  }, [active]);
}

// ─── Animation state hook ─────────────────────────────────────────────────────
// Two-phase: mounted (in DOM) ↔ visible (CSS transition active).
// Exit: transition out first (200ms), then unmount.

function useModalAnimation(isOpen: boolean) {
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      // Trigger enter transition on the next animation frame
      const raf = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true));
      });
      return () => cancelAnimationFrame(raf);
    } else {
      // Start exit transition, then unmount
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 220);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  return { mounted, visible };
}

// ─── Size variants ────────────────────────────────────────────────────────────

const SIZE = {
  sm: "max-w-sm",
  md: "max-w-[540px]",
  lg: "max-w-2xl",
} as const;

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ModalProps {
  /** Controls whether the modal is rendered and visible */
  isOpen: boolean;
  /** Called when the backdrop is clicked, Escape is pressed, or the X button is tapped */
  onClose: () => void;
  /**
   * Human-readable modal title — used as the aria-labelledby value that
   * screen readers announce when the modal opens.
   * This does NOT render a visible heading; use Modal.Header for that.
   */
  title: string;
  /** Controls the max-width of the modal box. @default 'md' */
  size?: keyof typeof SIZE;
  children: ReactNode;
  /** Extra classes applied to the modal box (not the backdrop) */
  className?: string;
}

// ─── Modal (root) ─────────────────────────────────────────────────────────────

export function Modal({
  isOpen,
  onClose,
  title,
  size = "md",
  children,
  className,
}: ModalProps) {
  const titleId = useId();
  const boxRef = useRef<HTMLDivElement>(null);
  const { mounted, visible } = useModalAnimation(isOpen);

  useFocusTrap(boxRef, isOpen && mounted);
  useBodyScrollLock(isOpen);

  // Escape key
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  // Backdrop click — close only when the backdrop itself is clicked
  const handleBackdropClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.target === e.currentTarget) onClose();
    },
    [onClose]
  );

  if (!mounted) return null;

  return createPortal(
    <ModalContext.Provider value={{ onClose, titleId }}>
      {/* ── Backdrop ─────────────────────────────────────────────────── */}
      {/*
       * No backdrop-blur — avoids any frosted-glass aesthetic (DESIGN.md ban).
       * abyssal-slate at ~82% opacity gives sufficient contrast without
       * completely hiding the page context beneath.
       */}
      <div
        role="presentation"
        onClick={handleBackdropClick}
        className={cn(
          "fixed inset-0 z-50",
          "flex items-start justify-center",
          "px-4 py-12 sm:py-16",
          "overflow-y-auto",
          // Backdrop fade
          "transition-opacity duration-200",
          visible ? "opacity-100" : "opacity-0"
        )}
        style={{ background: "rgba(9, 14, 27, 0.82)" }}
        aria-hidden="true"
      >
        {/* ── Modal box ───────────────────────────────────────────────── */}
        <div
          ref={boxRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onKeyDown={handleKeyDown}
          data-testid="modal-box"
          className={cn(
            // Surface
            "w-full bg-canvas-surface",
            "border border-tactical-border",
            "rounded-2xl",
            // Non-glowing depth — a single diffuse shadow ring, no glow colour
            "shadow-[0_8px_40px_rgba(0,0,0,0.55)]",
            // Size
            SIZE[size],
            // Enter / exit animation
            "transition-[opacity,transform] duration-200",
            "ease-[cubic-bezier(0.16,1,0.3,1)]",
            visible
              ? "opacity-100 scale-100 translate-y-0"
              : "opacity-0 scale-[0.97] translate-y-1",
            // Caller overrides
            className
          )}
          // Stop backdrop click from propagating INTO the box
          onClick={(e) => e.stopPropagation()}
        >
          {children}
        </div>
      </div>
    </ModalContext.Provider>,
    document.body
  );
}

// ─── Modal.Header ─────────────────────────────────────────────────────────────

export interface ModalHeaderProps {
  /**
   * Content renders between the left padding and the close button.
   * Typically contains an eyebrow label + h2 title, or just a title.
   */
  children: ReactNode;
  /** Extra classes on the header container */
  className?: string;
}

function ModalHeader({ children, className }: ModalHeaderProps) {
  const { onClose, titleId } = useContext(ModalContext);

  return (
    <div
      className={cn(
        "flex items-start justify-between gap-4",
        "px-6 pt-5 pb-4",
        "border-b border-tactical-border",
        className
      )}
    >
      {/* Title slot — caller is responsible for the visible h2 */}
      <div id={titleId} className="flex-1 min-w-0">
        {children}
      </div>

      {/* Close button */}
      <button
        onClick={onClose}
        aria-label="Close modal"
        className={cn(
          "shrink-0 p-1 -mr-1 rounded-lg",
          "text-muted-text",
          "hover:text-pearl-text hover:bg-tactical-border/40",
          "transition-colors duration-150",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-muted-emerald focus-visible:ring-offset-2",
          "focus-visible:ring-offset-canvas-surface",
          "cursor-pointer"
        )}
      >
        <X size={18} strokeWidth={2} aria-hidden="true" />
      </button>
    </div>
  );
}

// ─── Modal.Body ───────────────────────────────────────────────────────────────

export interface ModalBodyProps {
  children: ReactNode;
  /** When true, the body scrolls independently; the header stays pinned */
  scrollable?: boolean;
  className?: string;
}

function ModalBody({
  children,
  scrollable = true,
  className,
}: ModalBodyProps) {
  return (
    <div
      className={cn(
        "px-6 py-5",
        scrollable && "overflow-y-auto max-h-[calc(85vh-120px)]",
        // Custom scrollbar — thin, palette-matched
        "scrollbar-thin",
        "[&::-webkit-scrollbar]:w-[3px]",
        "[&::-webkit-scrollbar-track]:bg-transparent",
        "[&::-webkit-scrollbar-thumb]:bg-tactical-border",
        "[&::-webkit-scrollbar-thumb]:rounded-full",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Modal.Footer ─────────────────────────────────────────────────────────────

export interface ModalFooterProps {
  children: ReactNode;
  className?: string;
}

function ModalFooter({ children, className }: ModalFooterProps) {
  return (
    <div
      className={cn(
        "flex items-center justify-end gap-3",
        "px-6 py-4",
        "border-t border-tactical-border",
        className
      )}
    >
      {children}
    </div>
  );
}

// ─── Attach sub-components as static properties ───────────────────────────────

Modal.Header = ModalHeader;
Modal.Body = ModalBody;
Modal.Footer = ModalFooter;

// ─── ModalLoadingBody ─────────────────────────────────────────────────────────
// Reusable skeleton layout used inside modals while their detail query loads.
// Callers render this inside Modal.Body when isLoading is true.

export function ModalLoadingBody({ rows = 4 }: { rows?: number }) {
  return (
    <div
      className="flex flex-col gap-4"
      aria-label="Loading"
      aria-busy="true"
    >
      {Array.from({ length: rows }).map((_, i) => (
        <div
          key={i}
          className="h-4 rounded bg-abyssal-slate animate-pulse"
          style={{ width: `${70 + (i % 3) * 10}%` }}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

// ─── ModalErrorBody ───────────────────────────────────────────────────────────
// Rendered inside Modal.Body when a detail query fails.

export function ModalErrorBody({ onRetry }: { onRetry: () => void }) {
  return (
    <div
      className="flex flex-col items-center gap-4 py-8 text-center"
      role="alert"
    >
      <p className="font-sans text-sm text-muted-text">
        Unable to load details.
      </p>
      <button
        onClick={onRetry}
        className={cn(
          "inline-flex items-center gap-2 px-4 py-2",
          "rounded-lg border border-tactical-border bg-transparent",
          "font-sans text-sm text-pearl-text",
          "hover:border-muted-emerald transition-colors duration-200 cursor-pointer",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-muted-emerald focus-visible:ring-offset-2",
          "focus-visible:ring-offset-canvas-surface"
        )}
      >
        Retry
      </button>
    </div>
  );
}
