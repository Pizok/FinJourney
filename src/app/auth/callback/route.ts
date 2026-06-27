import { NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { apiFetchServer } from '@/lib/apiClient.server'

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get('code')
  
  // if "next" is in param, use it as the redirect URL
  const next = searchParams.get('next') ?? '/'

  if (code) {
    const cookieStore = await cookies()
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
              // The `setAll` method was called from a Server Component.
              // This can be ignored if you have middleware refreshing
              // user sessions.
            }
          },
        },
      }
    )
    
    const { data: { session }, error } = await supabase.auth.exchangeCodeForSession(code)
    
    if (!error && session) {
      const syncRes = await apiFetchServer<{ success: boolean; data: { has_completed_setup: boolean } }>(
        'auth/sync',
        { method: 'POST' },
        session.access_token
      )
      
      if (!syncRes) {
        // Backend couldn't be reached or threw a 500
        return NextResponse.redirect(`${origin}/auth?error=Backend connection failed. Please try again.`)
      }
      
      const hasCompletedSetup = syncRes.data?.has_completed_setup ?? false
      
      let redirectUrl = hasCompletedSetup ? '/dashboard' : '/onboarding'
      if (next && next !== '/') {
        redirectUrl = next
      }

      return NextResponse.redirect(`${origin}${redirectUrl}`)
    }
  }

  // return the user to an error page with some instructions
  return NextResponse.redirect(`${origin}/auth?error=Could not authenticate user`)
}
