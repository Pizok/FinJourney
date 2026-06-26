import { createBrowserClient } from '@supabase/ssr'

// ─────────────────────────────────────────────────────────────────────────────
// apiFetchClient
// For use ONLY in Next.js Client Components (e.g. inside TanStack Query).
// Uses relative URLs to pass through the Next.js rewrite proxy.
// Retrieves the active session token from the browser client.
// Throws Error on failure, allowing React Query to handle the error state.
// ─────────────────────────────────────────────────────────────────────────────
export async function apiFetchClient<T = unknown>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )

  const { data: { session } } = await supabase.auth.getSession()
  const token = session?.access_token

  if (!token) {
    throw new Error('Unauthorized: No active session.')
  }

  const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint

  // Uses relative URL, relying on next.config.ts proxy
  const response = await fetch(`/api/v1/${cleanEndpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`,
      ...options.headers,
    },
  })

  let json;
  try {
    json = await response.json()
  } catch (e) {
    // If not json, throw generic error below
  }

  if (!response.ok) {
    if (json?.error?.message) {
      throw new Error(json.error.message)
    } else if (json?.detail) {
      if (Array.isArray(json.detail)) {
        throw new Error(json.detail.map((e: any) => `${e.loc?.join('.')} - ${e.msg}`).join(', '))
      }
      throw new Error(String(json.detail))
    }
    throw new Error(`Failed to load data (${response.status})`)
  }

  if (json && json.success === false) {
    throw new Error(json.error?.message ?? 'Unknown API Error')
  }

  return (json && 'data' in json ? json.data : json) as T
}
