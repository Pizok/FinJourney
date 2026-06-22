"use client";

import { createContext, useContext, ReactNode } from "react";
import type { AnalyticsBootstrap } from "../types/analytics.types";

export type AnalyticsData = AnalyticsBootstrap;

export const AnalyticsContext = createContext<AnalyticsData | null>(null);

export function useAnalyticsData(): AnalyticsData {
  const context = useContext(AnalyticsContext);
  if (!context) {
    throw new Error("useAnalyticsData must be used within an AnalyticsProvider");
  }
  return context;
}

export function AnalyticsProvider({
  data,
  children,
}: {
  data: AnalyticsData;
  children: ReactNode;
}) {
  return (
    <AnalyticsContext.Provider value={data}>
      {children}
    </AnalyticsContext.Provider>
  );
}
