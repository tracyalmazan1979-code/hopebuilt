import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

const isProduction = process.env.NODE_ENV === 'production'

const cookieConfig = {
  ...(isProduction && {
    cookieOptions: {
      secure: true,
      sameSite: 'lax' as const,
      httpOnly: true,
    },
  }),
}

export function createClient() {
  const cookieStore = cookies()

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...cookieConfig,
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
            // setAll can be called from Server Components where cookies
            // can't be set. This can be ignored if middleware refreshes
            // the session.
          }
        },
      },
    }
  )
}
