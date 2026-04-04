'use client'

import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase'

export default function LoginPage() {
  const params      = useSearchParams()
  const rawRedirect = params.get('redirectTo')
  const redirectTo  = (!rawRedirect || rawRedirect === '/') ? '/dashboard' : rawRedirect

  const [email,    setEmail]    = useState('')
  const [password, setPassword] = useState('')
  const [mode,     setMode]     = useState<'password' | 'magic'>('magic')
  const [loading,  setLoading]  = useState(false)
  const [sent,     setSent]     = useState(false)
  const [error,    setError]    = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError(null)

    if (mode === 'magic') {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithOtp({
        email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })
      setLoading(false)
      if (authError) { setError(authError.message); return }
      setSent(true)
      return
    }

    // Password login — createBrowserClient stores session in cookies
    const supabase = createClient()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })

    setLoading(false)

    if (authError) {
      setError(authError.message)
      return
    }

    // Hard navigation so middleware re-runs with the new cookies
    window.location.href = redirectTo
  }

  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-6">
      <div className="w-full max-w-[380px]">

        <div className="text-center mb-10">
          <div className="font-syne font-black text-2xl tracking-widest uppercase text-amber-400 mb-1">
            Hope Built
          </div>
          <div className="text-sm text-muted">F&C Command Center</div>
        </div>

        <div className="card p-8">
          {sent ? (
            <div className="text-center py-4">
              <div className="text-4xl mb-4">📬</div>
              <h2 className="font-syne font-bold text-lg text-default mb-2">Check your email</h2>
              <p className="text-sm text-muted">
                We sent a magic link to <strong className="text-default">{email}</strong>.
                Click the link to sign in.
              </p>
              <button
                onClick={() => setSent(false)}
                className="mt-6 text-xs text-muted hover:text-default underline"
              >
                Use a different email
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <h2 className="font-syne font-bold text-lg text-default mb-1">Sign in</h2>
                <p className="text-xs text-muted">IDEA Facilities & Construction · Authorized users only</p>
              </div>

              <div className="flex rounded-md overflow-hidden border border-default text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => setMode('magic')}
                  className={`flex-1 py-2 transition-colors ${
                    mode === 'magic'
                      ? 'bg-amber-500/15 text-amber-400 border-r border-amber-500/30'
                      : 'text-muted hover:text-default border-r border-default'
                  }`}
                >
                  Magic Link
                </button>
                <button
                  type="button"
                  onClick={() => setMode('password')}
                  className={`flex-1 py-2 transition-colors ${
                    mode === 'password'
                      ? 'bg-amber-500/15 text-amber-400'
                      : 'text-muted hover:text-default'
                  }`}
                >
                  Password
                </button>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="you@pmsitx.com"
                  required
                  className="input-base"
                />
              </div>

              {mode === 'password' && (
                <div className="space-y-1.5">
                  <label className="text-xs font-semibold text-muted uppercase tracking-wider">
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={e => setPassword(e.target.value)}
                    required
                    className="input-base"
                  />
                </div>
              )}

              {error && (
                <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/20 rounded-md px-3 py-2">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading || !email}
                className="w-full py-2.5 rounded-md bg-amber-500 text-black font-bold text-sm
                           hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {loading
                  ? 'Signing in…'
                  : mode === 'magic'
                  ? 'Send Magic Link'
                  : 'Sign In'
                }
              </button>

              <p className="text-center text-[10px] text-dim">
                Access is restricted to authorized IDEA & PMSI personnel.
              </p>
            </form>
          )}
        </div>

        <p className="text-center text-[10px] text-dim mt-6">
          Hope Built Advisory · F&C Command Center · v0.1
        </p>
      </div>
    </div>
  )
}
