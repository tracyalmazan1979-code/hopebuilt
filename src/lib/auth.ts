import { createClient } from '@/lib/supabase-server'
import { redirect } from 'next/navigation'
import type { UserRole } from '@/types'

// Role hierarchy: higher index = more access
const ROLE_LEVELS: Record<UserRole, number> = {
  read_only: 0,
  leadership: 1,
  approver: 2,
  coordinator: 3,
  admin: 4,
}

/** Check if a role has at least the required access level */
export function hasRole(userRole: UserRole, requiredRole: UserRole): boolean {
  return ROLE_LEVELS[userRole] >= ROLE_LEVELS[requiredRole]
}

/**
 * Server-side auth guard. Call at the top of protected server components.
 * Returns the authenticated user + profile, or redirects to login/unauthorized.
 */
export async function requireAuth(minimumRole?: UserRole) {
  const supabase = createClient()
  const { data: { user: authUser } } = await supabase.auth.getUser()

  if (!authUser) {
    redirect('/auth/login')
  }

  const { data: profile } = await supabase
    .from('users')
    .select('*, organizations(*)')
    .eq('id', authUser.id)
    .single()

  if (minimumRole && profile && !hasRole(profile.role, minimumRole)) {
    redirect('/dashboard?error=unauthorized')
  }

  return { supabase, authUser, profile }
}
