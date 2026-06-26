'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { MotionConfig } from 'framer-motion'
import { useSettingsStore } from '@/components/settings/store/settingsStore'

export default function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 1000 * 60 * 2, // 2 minutes
            refetchOnWindowFocus: false,
          },
        },
      })
  )

  const reducedMotion = useSettingsStore((s) => s.currentSettings.preferences.reduced_motion)

  return (
    <QueryClientProvider client={queryClient}>
      <MotionConfig reducedMotion={reducedMotion ? 'always' : 'user'}>
        {children}
      </MotionConfig>
      <Toaster
        position="bottom-right"
        theme="dark"
        toastOptions={{
          classNames: {
            toast:
              'font-sans text-sm border border-tactical-border bg-canvas-surface text-pearl-text',
            description: 'text-muted-text',
            error: 'border-terracotta/40 text-terracotta',
            success: 'border-muted-emerald/40',
          },
        }}
      />
    </QueryClientProvider>
  )
}
