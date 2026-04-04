// src/app/approval-result/page.tsx
// No auth required — this page is shown after one-click approval from email

export default function ApprovalResultPage({
  searchParams,
}: {
  searchParams: { status?: string; doc?: string; approver?: string; reason?: string }
}) {
  const { status, doc, approver, reason } = searchParams

  const configs = {
    approve: {
      icon:  '✅',
      title: 'Approved',
      color: '#16a34a',
      bg:    '#f0fdf4',
      border:'#bbf7d0',
      msg:   `Your approval has been recorded. The document will automatically advance to the next stage.`,
    },
    deny: {
      icon:  '❌',
      title: 'Denied',
      color: '#dc2626',
      bg:    '#fef2f2',
      border:'#fca5a5',
      msg:   `The denial has been recorded. The coordinator has been notified.`,
    },
    hold: {
      icon:  '⏸',
      title: 'Placed on Hold',
      color: '#d97706',
      bg:    '#fffbeb',
      border:'#fcd34d',
      msg:   `The item has been placed on hold. The coordinator has been notified.`,
    },
    error: {
      icon:  '⚠️',
      title: 'Link Expired or Already Used',
      color: '#6b7280',
      bg:    '#f9fafb',
      border:'#e5e7eb',
      msg:   reason ?? 'This approval link is no longer valid. It may have expired (48 hours) or already been used.',
    },
  }

  const config = configs[status as keyof typeof configs] ?? configs.error

  return (
    <div style={{
      minHeight: '100vh',
      background: '#0D1117',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '24px',
      fontFamily: 'Arial, sans-serif',
    }}>
      <div style={{ maxWidth: 480, width: '100%' }}>

        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontSize: 13, fontWeight: 900, letterSpacing: '.1em', textTransform: 'uppercase', color: '#F59E0B' }}>
            Hope Built
          </div>
          <div style={{ fontSize: 11, color: '#6b7280', marginTop: 2 }}>F&C Command Center</div>
        </div>

        {/* Result card */}
        <div style={{
          background: config.bg,
          border: `1px solid ${config.border}`,
          borderRadius: 12,
          padding: 32,
          textAlign: 'center',
        }}>
          <div style={{ fontSize: 48, marginBottom: 12 }}>{config.icon}</div>
          <h1 style={{ fontSize: 22, fontWeight: 800, color: config.color, margin: '0 0 8px' }}>
            {config.title}
          </h1>
          {doc && (
            <div style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 8 }}>
              {decodeURIComponent(doc)}
            </div>
          )}
          {approver && (
            <div style={{ fontSize: 12, color: '#6b7280', marginBottom: 16 }}>
              Recorded for {decodeURIComponent(approver)}
            </div>
          )}
          <p style={{ fontSize: 13, color: '#374151', margin: '0 0 24px', lineHeight: 1.6 }}>
            {config.msg}
          </p>
          <a
            href={`${process.env.NEXT_PUBLIC_APP_URL ?? ''}/dashboard`}
            style={{
              display: 'inline-block',
              background: '#1F4E79',
              color: '#fff',
              padding: '10px 24px',
              borderRadius: 8,
              textDecoration: 'none',
              fontWeight: 600,
              fontSize: 13,
            }}
          >
            Open Command Center →
          </a>
        </div>

        <p style={{ textAlign: 'center', fontSize: 11, color: '#4b5563', marginTop: 16 }}>
          This action has been logged and attributed to your email address.
        </p>
      </div>
    </div>
  )
}
