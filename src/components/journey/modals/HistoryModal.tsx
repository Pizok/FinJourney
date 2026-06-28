"use client";

import { useInfiniteQuery } from "@tanstack/react-query";
import { BookOpen, RefreshCw } from "lucide-react";
import { Modal, ModalLoadingBody, ModalErrorBody } from "@/components/ui/Modal";
import { EmptyState } from "@/components/ui/EmptyState";
import { HistoryEvent } from "@/components/journey/features/HistoryEvent";
import {
  JOURNEY_QUERY_KEYS,
  type HistoryPage,
  type ApiResponse,
} from "@/components/journey/types/journey.types";
import { cn } from "@/lib/utils";
import React from "react";
import { apiFetchClient } from "@/lib/apiClient.client";

// ─── API fetcher ──────────────────────────────────────────────────────────────

async function fetchHistoryPage(page: number): Promise<HistoryPage> {
  const data = await apiFetchClient<HistoryPage>(
    `journey/history?page=${page}&limit=20`
  );

  return data;
}

// ─── Load more button ─────────────────────────────────────────────────────────

interface LoadMoreButtonProps {
  onClick: () => void;
  isLoading: boolean;
}

function LoadMoreButton({ onClick, isLoading }: LoadMoreButtonProps) {
  return (
    <div className="border-t border-tactical-border">
      <button
        onClick={onClick}
        disabled={isLoading}
        aria-label={isLoading ? "Loading more events" : "Load more events"}
        className={cn(
          "flex items-center justify-center gap-2",
          "w-full px-5 py-4",
          "font-sans text-[13px] text-pearl-text",
          "bg-transparent",
          "hover:bg-tactical-border/20",
          "transition-colors duration-200",
          "cursor-pointer disabled:cursor-default",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-inset focus-visible:ring-muted-emerald/50"
        )}
      >
        <RefreshCw
          size={13}
          strokeWidth={2}
          aria-hidden="true"
          className={cn(isLoading && "animate-spin")}
        />
        {isLoading ? "Loading…" : "Load more events"}
      </button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

interface HistoryModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function HistoryModal({ isOpen, onClose }: HistoryModalProps) {
  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
    isError,
    refetch,
  } = useInfiniteQuery({
    queryKey: JOURNEY_QUERY_KEYS.history(),
    queryFn: ({ pageParam }) => fetchHistoryPage(pageParam as number),
    initialPageParam: 1 as number,
    getNextPageParam: (lastPage) =>
      lastPage.next_page != null ? lastPage.next_page : undefined,
    staleTime: 60_000,
    enabled: isOpen,
  });

  const events = data?.pages.flatMap((page) => page.events) ?? [];
  const isLoadingMore = isFetchingNextPage;

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="7-Day History" size="md">
      <Modal.Header>
        <div className="flex flex-col gap-[3px]">
          <p className="font-sans text-[11px] font-semibold uppercase tracking-[0.1em] text-muted-text">
            Activity Log
          </p>
          <h2 className="font-display text-[19px] font-semibold text-pearl-text tracking-[-0.01em] leading-tight">
            7-Day History
          </h2>
        </div>
      </Modal.Header>

      {isLoading ? (
        <Modal.Body>
          <ModalLoadingBody rows={4} />
        </Modal.Body>
      ) : isError ? (
        <Modal.Body>
          <ModalErrorBody onRetry={refetch} />
        </Modal.Body>
      ) : events.length === 0 ? (
        <Modal.Body>
          <div className="py-6">
            <EmptyState
              icon={BookOpen}
              message="No history yet."
              description="Transactions, achievements, and milestones you reach will appear here."
            />
          </div>
        </Modal.Body>
      ) : (
        <Modal.Body className="p-0 sm:p-0">
          <div aria-live="polite" aria-relevant="additions" className="flex flex-col">
            {events.map((event, index) => (
              <HistoryEvent
                key={event.id}
                event={event}
                isLast={index === events.length - 1 && !hasNextPage}
              />
            ))}

            {hasNextPage ? (
              <LoadMoreButton
                onClick={() => fetchNextPage()}
                isLoading={isLoadingMore}
              />
            ) : (
              <div className="py-4 text-center border-t border-tactical-border">
                <span className="font-sans text-[11px] text-muted-text">
                  You've reached the end of your 7-day history.
                </span>
              </div>
            )}
          </div>
        </Modal.Body>
      )}
    </Modal>
  );
}
