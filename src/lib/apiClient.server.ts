import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

// ─────────────────────────────────────────────────────────────────────────────
// apiFetchServer
// For use ONLY in Next.js App Router Server Components.
// Reads the session from cookies, constructs an absolute URL, and injects the
// JWT into the Authorization header.
// Returns `null` on failure (graceful degradation).
// ─────────────────────────────────────────────────────────────────────────────
export async function apiFetchServer<T = unknown>(
  endpoint: string,
  options: RequestInit = {},
  overrideToken?: string,
): Promise<T | null> {
  try {
    const cookieStore = await cookies()
    let token = overrideToken

    if (!token) {
      const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
          cookies: {
            getAll() {
              return cookieStore.getAll()
            },
            setAll(cookiesToSet) {
              try {
                cookiesToSet.forEach(({ name, value, options }) =>
                  cookieStore.set(name, value, options)
                )
              } catch {
                // Ignore inside server component
              }
            },
          },
        }
      )

      const { data: { session } } = await supabase.auth.getSession()
      token = session?.access_token
    }

    if (!token) {
      console.warn(`[apiFetchServer] Unauthorized: No active session token found for ${endpoint}`)
      redirect('/auth')
    }

    const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? 'http://127.0.0.1:8000'
    // Ensure endpoint doesn't have leading slash if we append it
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.slice(1) : endpoint

    const response = await fetch(`${baseUrl}/api/v1/${cleanEndpoint}`, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`,
        ...options.headers,
      },
    })

    if (!response.ok) {
      console.error(`[apiFetchServer] ${response.status} ${response.statusText} on ${endpoint}`)
      if (response.status === 401) {
        redirect('/auth')
      }
      return null
    }

    const json = await response.json()
    if (json && json.success === false) {
      console.error(`[apiFetchServer] API returned error for ${endpoint}:`, json.error)
      return null
    }

    return (json && 'data' in json ? json.data : json) as T
  } catch (error: any) {
    if (error && typeof error === 'object' && 'digest' in error) {
      throw error; // Re-throw Next.js internal errors (redirect, dynamic server usage, etc.)
    }
    console.error(`[apiFetchServer] Fatal error fetching ${endpoint}:`, error)
    return null
  }
}
