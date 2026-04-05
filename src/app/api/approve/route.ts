// ============================================================
// HOPE BUILT ADVISORY — One-Click Approval API
// GET /api/approve?token=xxx
//
// Called from approval emails. No login required.
// Token is single-use, 48-hour expiry.
// On success → redirect to a confirmation page.
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { Resend } from 'resend'
import { format } from 'date-fns'

// Use service role for token operations (bypasses RLS)
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const resend = new Resend(process.env.RESEND_API_KEY!)
const APP_URL = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000'
const FROM    = 'F&C Command Center <fac@hopebuiltadvisory.com>'

// ── GET: handle token click ───────────────────────────────────

export async function GET(request: NextRequest) {
  const token  = request.nextUrl.searchParams.get('token')
  const ip     = request.headers.get('x-forwarded-for') ?? request.ip ?? 'unknown'

  if (!token) {
    return NextResponse.redirect(`${APP_URL}/auth/login?error=missing_token`)
  }

  // Use the token via DB function (atomic, prevents double-use)
  const { data, error } = await supabase
    .rpc('use_approval_token', { p_token: token, p_ip: ip })

  if (error || !data?.success) {
    const reason = data?.error ?? 'Token invalid or expired'
    return NextResponse.redirect(
      `${APP_URL}/approval-result?status=error&reason=${encodeURIComponent(reason)}`
    )
  }

  const { action, document_id, approver_name } = data

  // Fetch document details for the confirmation + next notification
  const { data: doc } = await supabase
    .from('documents')
    .select('*, approvals(*)')
    .eq('id', document_id)
    .single()

  if (doc) {
    // Fire next-stage notification
    await notifyNextStage(doc, approver_name, action)
  }

  // Redirect to confirmation
  return NextResponse.redirect(
    `${APP_URL}/approval-result?status=${action}&doc=${encodeURIComponent(doc?.campus_name ?? '')}&approver=${encodeURIComponent(approver_name ?? '')}`
  )
}

// ── POST: send approval email with one-click links ────────────

export async function POST(request: NextRequest) {
  // Requires auth
  const authHeader = request.headers.get('authorization')
  if (!authHeader) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { approval_id, document_id, approver_name, approver_email, stage } = body

  // Create tokens for approve, deny, hold
  const [approveToken, denyToken, holdToken] = await Promise.all([
    supabase.rpc('create_approval_token', {
      p_approval_id:    approval_id,
      p_action:         'approve',
      p_approver_name:  approver_name,
      p_approver_email: approver_email,
    }),
    supabase.rpc('create_approval_token', {
      p_approval_id:    approval_id,
      p_action:         'deny',
      p_approver_name:  approver_name,
      p_approver_email: approver_email,
    }),
    supabase.rpc('create_approval_token', {
      p_approval_id:    approval_id,
      p_action:         'hold',
      p_approver_name:  approver_name,
      p_approver_email: approver_email,
    }),
  ])

  // Fetch document
  const { data: doc } = await supabase
    .from('documents')
    .select('*')
    .eq('id', document_id)
    .single()

  if (!doc) return NextResponse.json({ error: 'Document not found' }, { status: 404 })

  const approveUrl = `${APP_URL}/api/approve?token=${approveToken.data}`
  const denyUrl    = `${APP_URL}/api/approve?token=${denyToken.data}`
  const holdUrl    = `${APP_URL}/api/approve?token=${holdToken.data}`
  const viewUrl    = `${APP_URL}/documents/${document_id}`

  const stageLabels: Record<string, string> = {
    coo:               'COO Approval',
    treasury_finance:  'Treasury / Finance Approval',
    legal:             'Legal Review',
    finance_committee: 'Finance Committee Review',
    board:             'Board Approval',
  }

  const amount = doc.amount != null
    ? doc.amount < 0
      ? `($${Math.abs(doc.amount).toLocaleString('en-US', { minimumFractionDigits: 2 })})`
      : `$${doc.amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
    : '—'

  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width">
</head>
<body style="font-family:Arial,sans-serif;background:#f4f4f4;margin:0;padding:24px;">
  <div style="max-width:560px;margin:0 auto;">

    <!-- Header -->
    <div style="background:#1F4E79;padding:20px 24px;border-radius:8px 8px 0 0;">
      <p style="color:#F59E0B;font-size:11px;font-weight:bold;letter-spacing:.1em;text-transform:uppercase;margin:0 0 4px;">Action Required</p>
      <h2 style="color:#fff;margin:0;font-size:18px;">${stageLabels[stage] ?? 'Approval Needed'}</h2>
    </div>

    <!-- Body -->
    <div style="background:#fff;padding:24px;border:1px solid #e5e7eb;border-top:none;border-radius:0 0 8px 8px;">
      
      <p style="font-size:14px;color:#374151;margin:0 0 20px;">
        Hi ${approver_name ?? 'there'},<br><br>
        The following document requires your ${stageLabels[stage] ?? 'approval'} before it can proceed.
      </p>

      <!-- Document summary -->
      <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin-bottom:24px;">
        <table style="width:100%;">
          <tr>
            <td style="font-size:11px;color:#9ca3af;text-transform:uppercase;letter-spacing:.05em;padding-bottom:4px;">Campus / Project</td>
          </tr>
          <tr>
            <td style="font-size:18px;font-weight:bold;color:#111827;padding-bottom:12px;">${doc.campus_name}</td>
          </tr>
          <tr>
            <td style="font-size:13px;color:#6b7280;padding-bottom:4px;">${doc.document_type_name}</td>
          </tr>
        </table>
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;">
        <table style="width:100%;border-collapse:collapse;">
          ${[
            ['Amount',         amount],
            ['Funding Source',  doc.funding_source ?? '—'],
            ['State',          doc.state],
            ['Presenter',      doc.presenter_name ?? '—'],
          ].map(([l,v]) => `
          <tr>
            <td style="font-size:11px;color:#9ca3af;padding:4px 0;width:120px;">${l}</td>
            <td style="font-size:13px;color:#111827;font-weight:500;padding:4px 0;">${v}</td>
          </tr>`).join('')}
        </table>
        ${doc.description ? `
        <hr style="border:none;border-top:1px solid #e5e7eb;margin:12px 0;">
        <p style="font-size:12px;color:#374151;margin:0;line-height:1.5;">${doc.description.substring(0, 300)}${doc.description.length > 300 ? '…' : ''}</p>
        ` : ''}
      </div>

      <!-- One-click action buttons -->
      <p style="font-size:12px;font-weight:bold;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin:0 0 12px;">Your Decision</p>
      
      <table style="width:100%;border-collapse:separate;border-spacing:8px;">
        <tr>
          <td style="width:33%;">
            <a href="${approveUrl}" style="display:block;background:#16a34a;color:#fff;text-align:center;padding:14px 8px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;">
              ✅ Approve
            </a>
          </td>
          <td style="width:33%;">
            <a href="${holdUrl}" style="display:block;background:#d97706;color:#fff;text-align:center;padding:14px 8px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;">
              ⏸ Put on Hold
            </a>
          </td>
          <td style="width:33%;">
            <a href="${denyUrl}" style="display:block;background:#dc2626;color:#fff;text-align:center;padding:14px 8px;border-radius:8px;text-decoration:none;font-weight:bold;font-size:13px;">
              ❌ Deny
            </a>
          </td>
        </tr>
      </table>

      <p style="font-size:11px;color:#9ca3af;text-align:center;margin:16px 0 0;">
        One-click actions are logged and attributed to you. Links expire in 48 hours.<br>
        <a href="${viewUrl}" style="color:#1F4E79;">View full document →</a>
      </p>
    </div>

    <p style="text-align:center;font-size:11px;color:#9ca3af;margin:12px 0 0;">
      F&C Command Center · Hope Built Advisory · ${format(new Date(), "MMM d, yyyy 'at' h:mm a")}
    </p>
  </div>
</body>
</html>`

  const result = await resend.emails.send({
    from:    FROM,
    to:      `${approver_name ?? ''} <${approver_email}>`,
    subject: `⚡ Action Required: ${stageLabels[stage] ?? 'Approval'} — ${doc.campus_name} ${doc.document_type_name ?? ''}`,
    html,
    tags: [
      { name: 'type',     value: 'approval_request' },
      { name: 'stage',    value: stage               },
      { name: 'doc_id',   value: document_id         },
    ],
  })

  return NextResponse.json({ success: !result.error, message_id: result.data?.id })
}

// ── Notify next stage after approval ─────────────────────────

async function notifyNextStage(doc: any, approverName: string, action: string) {
  if (action !== 'approve') return // only route forward on approval

  // Find next pending required approval
  const sortedApprovals = (doc.approvals ?? [])
    .sort((a: any, b: any) => a.stage_order - b.stage_order)

  const nextPending = sortedApprovals.find(
    (a: any) => a.status === 'pending' && a.is_required
  )

  if (!nextPending) return // all approved

  // Get approver config for this stage
  const stageApprovers: Record<string, { name: string; email: string }[]> = {
    coo: [
      { name: 'Trevor Brooks', email: process.env.COO_EMAIL ?? 'coo@ideapublicschools.org' },
    ],
    treasury_finance: [
      { name: 'Layne Fisher', email: process.env.TREASURY_EMAIL ?? 'layne.fisher@ideapublicschools.org' },
    ],
    legal: [
      { name: 'Myla Matthews', email: process.env.LEGAL_EMAIL ?? 'myla.matthews@ideapublicschools.org' },
    ],
  }

  const approvers = stageApprovers[nextPending.stage]
  if (!approvers) return

  for (const approver of approvers) {
    await fetch(`${APP_URL}/api/approve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': 'internal' },
      body: JSON.stringify({
        approval_id:    nextPending.id,
        document_id:    doc.id,
        approver_name:  approver.name,
        approver_email: approver.email,
        stage:          nextPending.stage,
      }),
    })
  }
}
