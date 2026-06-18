'use client'

import { useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'

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

  return (
    <QueryClientProvider client={queryClient}>
      {children}
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
