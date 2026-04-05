'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { signOut } from '@/lib/supabase'
import type { User, Organization, DashboardMetrics } from '@/types'
import {
  Zap, FileText, Calendar, Building2, Archive,
  PauseCircle, Users, BookOpen, LogOut, Plus,
  BarChart3, Settings, ChevronRight, ClipboardList,
} from 'lucide-react'
import { clsx } from 'clsx'

// ── Nav config ───────────────────────────────────────────────

interface NavItem {
  label:    string
  href:     string
  icon:     React.ReactNode
  badge?:   number
  color?:   string
  section?: string
}

function buildNavItems(metrics?: DashboardMetrics | null): NavItem[] {
  return [
    // Workspace
    {
      section: 'Workspace',
      label:   'Command Center',
      href:    '/dashboard',
      icon:    <Zap size={15} />,
      color:   'amber',
    },
    {
      label: 'All Documents',
      href:  '/documents',
      icon:  <FileText size={15} />,
      badge: metrics ? metrics.total_active : undefined,
    },
    {
      label: 'Leadership View',
      href:  '/leadership',
      icon:  <BarChart3 size={15} />,
    },
    // Meetings
    {
      section: 'Meetings',
      label:   'FAC Doc Review',
      href:    '/meetings/fac',
      icon:    <Building2 size={15} />,
    },
    {
      label: 'Tactical',
      href:  '/meetings/tactical',
      icon:  <ClipboardList size={15} />,
    },
    {
      label: 'BOD Items',
      href:  '/bod',
      icon:  <BookOpen size={15} />,
      badge: metrics?.pending_bod || undefined,
    },
    {
      label: 'Calendar',
      href:  '/calendar',
      icon:  <Calendar size={15} />,
    },
    // Status
    {
      section: 'Status',
      label:   'On Hold',
      href:    '/on-hold',
      icon:    <PauseCircle size={15} />,
      badge:   metrics?.on_hold || undefined,
    },
    {
      label:  'Pending Docs',
      href:   '/pending',
      icon:   <Archive size={15} />,
      badge:  metrics?.pending_doc_count || undefined,
      color:  metrics?.pending_doc_count ? 'amber' : undefined,
    },
    {
      label: 'Archived',
      href:  '/archived',
      icon:  <Archive size={15} />,
    },
    // Reference
    {
      section: 'Reference',
      label:   'Committee',
      href:    '/committee',
      icon:    <Users size={15} />,
    },
    {
      label: 'Approval Matrix',
      href:  '/approval-matrix',
      icon:  <BookOpen size={15} />,
    },
  ]
}

// ── Sidebar ───────────────────────────────────────────────────

function Sidebar({
  user,
  org,
  metrics,
}: {
  user: User
  org:  Organization
  metrics?: DashboardMetrics | null
}) {
  const pathname  = usePathname()
  const router    = useRouter()
  const navItems  = buildNavItems(metrics)
  const [signing, setSigning] = useState(false)

  async function handleSignOut() {
    setSigning(true)
    await signOut()
    router.push('/auth/login')
  }

  // Group nav items by section
  const sections: { label?: string; items: NavItem[] }[] = []
  let currentSection: NavItem[] = []

  navItems.forEach(item => {
    if (item.section) {
      if (currentSection.length) sections.push({ items: currentSection })
      currentSection = [item]
    } else {
      currentSection.push(item)
    }
  })
  if (currentSection.length) sections.push({ items: currentSection })

  return (
    <aside className="w-[220px] min-w-[220px] flex flex-col bg-surface border-r border-default overflow-hidden">

      {/* Logo */}
      <div className="px-4 pt-5 pb-4 border-b border-default">
        <div className="bg-[#0072CE] rounded-md px-3 py-2.5 text-center">
          <div className="font-black text-[16px] tracking-[0.3em] uppercase text-white leading-none">IDEA</div>
          <div className="text-[8px] text-white/80 tracking-wider mt-0.5">Public Schools</div>
        </div>
        <div className="text-[10px] font-semibold text-gray-500 mt-2 tracking-wide text-center">
          Facilities & Construction
        </div>
      </div>

      {/* Client pill */}
      <div className="mx-3 mt-3 px-3 py-2 bg-blue-50 rounded-lg border border-blue-100 flex items-center gap-2">
        <div className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
        <span className="text-[11px] text-gray-600 truncate">{org?.name ?? 'No Organization'}</span>
      </div>

      {/* Quick action */}
      <div className="px-3 mt-3">
        <Link
          href="/documents/new"
          className="flex items-center justify-center gap-2 w-full py-2 rounded-md
                     bg-blue-600 text-white
                     text-xs font-semibold hover:bg-blue-700 transition-colors"
        >
          <Plus size={13} /> Submit Document
        </Link>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        {sections.map((section, si) => (
          <div key={si} className={si > 0 ? 'pt-3' : ''}>
            {section.items[0]?.section && (
              <div className="px-2 pb-1.5 text-[9.5px] font-bold tracking-widest uppercase text-dim">
                {section.items[0].section}
              </div>
            )}
            {section.items.map(item => {
              const isActive = pathname === item.href ||
                (item.href !== '/dashboard' && pathname.startsWith(item.href))

              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={clsx(
                    'flex items-center gap-2.5 px-2.5 py-[7px] rounded-md text-[12.5px] font-medium transition-all group',
                    isActive
                      ? 'bg-blue-50 text-blue-700 border border-blue-200'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900 border border-transparent'
                  )}
                >
                  <span className={clsx(
                    'flex-shrink-0 transition-colors',
                    isActive ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-500'
                  )}>
                    {item.icon}
                  </span>
                  <span className="flex-1 truncate">{item.label}</span>
                  {item.badge != null && item.badge > 0 && (
                    <span className={clsx(
                      'flex-shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded-full font-mono',
                      item.color === 'amber'
                        ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-500 text-white'
                    )}>
                      {item.badge}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </nav>

      {/* Footer */}
      <div className="px-3 py-3 border-t border-default space-y-1">
        <Link
          href="/settings"
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-dim hover:text-muted hover:bg-surface-2 transition-colors"
        >
          <Settings size={13} /> Settings
        </Link>
        <button
          onClick={handleSignOut}
          disabled={signing}
          className="flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-xs text-dim hover:text-red-400 hover:bg-red-500/10 transition-colors w-full text-left"
        >
          <LogOut size={13} /> {signing ? 'Signing out…' : 'Sign Out'}
        </button>
        <div className="px-2.5 pt-1">
          <div className="text-[11px] font-semibold text-muted truncate">
            {user.full_name}
          </div>
          <div className="text-[10px] text-dim truncate">{user.title ?? user.role}</div>
        </div>
      </div>
    </aside>
  )
}

// ── Topbar ────────────────────────────────────────────────────

function Topbar({
  title,
  user,
  children,
}: {
  title:    string
  user:     User
  children?: React.ReactNode
}) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'short', month: 'short', day: 'numeric', year: 'numeric',
  })

  // Wednesday indicator
  const isWednesday = now.getDay() === 3
  const hour = now.getHours()
  const isMeetingTime = isWednesday && hour >= 9 && hour < 17

  return (
    <header className="h-[54px] min-h-[54px] flex items-center justify-between px-6 bg-surface border-b border-default flex-shrink-0">
      <h1 className="font-syne font-bold text-[15px] text-default">{title}</h1>

      <div className="flex items-center gap-3">
        {/* Wednesday meeting alert */}
        {isMeetingTime && (
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/30 animate-pulse-amber">
            <div className="w-1.5 h-1.5 rounded-full bg-red-400" />
            <span className="text-[11px] font-semibold text-red-400">Meeting Day</span>
          </div>
        )}

        {children}

        {/* Date */}
        <div className="font-mono text-[11px] text-muted bg-surface-2 px-3 py-1 rounded-full border border-default">
          {dateStr}
        </div>

        {/* Avatar */}
        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-blue-600 to-blue-800 flex items-center justify-center text-[11px] font-bold text-white flex-shrink-0 cursor-pointer">
          {user.avatar_initials ?? user.full_name.slice(0, 2).toUpperCase()}
        </div>
      </div>
    </header>
  )
}

// ── App Shell ─────────────────────────────────────────────────

interface AppShellProps {
  user:      User
  org:       Organization
  metrics?:  DashboardMetrics | null
  title:     string
  topbarRight?: React.ReactNode
  children:  React.ReactNode
}

export function AppShell({
  user,
  org,
  metrics,
  title,
  topbarRight,
  children,
}: AppShellProps) {
  return (
    <div className="flex h-screen overflow-hidden">
      <Sidebar user={user} org={org} metrics={metrics} />
      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        <Topbar title={title} user={user}>
          {topbarRight}
        </Topbar>
        <main className="flex-1 overflow-y-auto bg-app">
          {children}
        </main>
      </div>
    </div>
  )
}
