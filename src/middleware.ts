import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

const isProduction = process.env.NODE_ENV === 'production'

export async function middleware(request: NextRequest) {
  let response = NextResponse.next({
    request: {
      headers: request.headers,
    },
  })

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  if (isProduction) {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
  }

  // CSRF protection for mutating API requests
  const { pathname } = request.nextUrl
  if (pathname.startsWith('/api/') && request.method !== 'GET') {
    const origin = request.headers.get('origin')
    const host = request.headers.get('host')
    if (origin && host && !origin.endsWith(host)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }
  }

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      ...(isProduction && {
        cookieOptions: {
          secure: true,
          sameSite: 'lax' as const,
          httpOnly: true,
        },
      }),
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          // Re-apply security headers after creating new response
          response.headers.set('X-Content-Type-Options', 'nosniff')
          response.headers.set('X-Frame-Options', 'DENY')
          response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
          if (isProduction) {
            response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload')
          }
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()

  const publicRoutes = ['/auth/login', '/auth/callback', '/auth/verify', '/approval-result', '/api/auth']
  const isPublic = publicRoutes.some(r => pathname.startsWith(r))
  // /api/approve uses its own token-based auth
  const isApproveRoute = pathname === '/api/approve'

  if (!user && !isPublic && !isApproveRoute) {
    const loginUrl = request.nextUrl.clone()
    loginUrl.pathname = '/auth/login'
    loginUrl.searchParams.set('redirectTo', pathname)
    return NextResponse.redirect(loginUrl)
  }

  if (user && pathname.startsWith('/auth/login')) {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  if (pathname === '/') {
    const dashboardUrl = request.nextUrl.clone()
    dashboardUrl.pathname = '/dashboard'
    return NextResponse.redirect(dashboardUrl)
  }

  return response
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|public|templates).*)',
  ],
}
