'use client'

import React, { createContext, useContext, useMemo } from 'react'
import type { JourneyOverview } from '../types/journey.types'

interface JourneyContextValue {
  overview: JourneyOverview
}

const JourneyContext = createContext<JourneyContextValue | null>(null)

export function useJourneyData(): JourneyOverview {
  const context = useContext(JourneyContext)
  if (!context) {
    throw new Error('useJourneyData must be used within a JourneyProvider')
  }
  return context.overview
}

interface JourneyProviderProps {
  overview: JourneyOverview
  children: React.ReactNode
}

export function JourneyProvider({ overview, children }: JourneyProviderProps) {
  const value = useMemo(() => ({ overview }), [overview])

  return (
    <JourneyContext.Provider value={value}>
      {children}
    </JourneyContext.Provider>
  )
}
