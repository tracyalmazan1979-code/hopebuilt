// ============================================================
// HOPE BUILT ADVISORY — CAF PDF Generator
// POST /api/documents/[id]/generate-caf
//
// Takes a document record, fills the IDEA CAF form template,
// uploads to Supabase Storage, updates document.caf_pdf_url.
//
// Dependencies: pdf-lib (add to package.json)
// Template: /public/templates/caf-template.pdf (the blank CAF)
// ============================================================

import { NextRequest, NextResponse } from 'next/server'
import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { format } from 'date-fns'
import type { Document } from '@/types'

// ── Field positions on the CAF PDF ────────────────────────────
// These are approximate coordinates based on the CAF layout.
// Fine-tune after overlaying on the actual template PDF.
// Format: [x, y] from bottom-left (pdf-lib origin)

const FIELD_POSITIONS = {
  date_of_request:        [120, 698],
  date_needed_by:         [120, 680],
  requester_name_title:   [310, 660],
  campus_department:      [310, 643],
  organization:           [310, 626],
  vendor_name:            [310, 608],
  coop_yes:               [295, 591],  // checkbox
  coop_no:                [325, 591],  // checkbox
  coop_name:              [420, 591],
  former_emp_yes:         [295, 574],
  former_emp_no:          [325, 574],
  former_emp_date:        [420, 574],
  students_yes:           [370, 558],
  students_no:            [400, 558],
  doc_type:               [230, 536],
  doc_other:              [430, 536],
  description:            [100, 490],  // large text area
  service_start_date:     [285, 400],
  service_end_date:       [470, 400],
  amount:                 [200, 378],
  fund_source:            [200, 352],
  // Section I
  board_yes:              [210, 305],
  board_no:               [240, 305],
  board_approval_date:    [420, 305],
  // Section II
  urgent_yes:             [170, 252],
  urgent_no:              [200, 252],
  urgent_reason:          [310, 252],
  // Section III — Approvals (left blank, signed manually)
  fac_committee_date:     [540, 725],  // top right
} as const

type FieldKey = keyof typeof FIELD_POSITIONS

interface CAFData {
  date_of_request:        string
  date_needed_by:         string | null
  requester_name_title:   string
  campus_department:      string
  organization:           string
  vendor_name:            string | null
  is_coop_member:         boolean | null
  coop_name:              string | null
  vendor_is_former_employee: boolean | null
  vendor_last_employment_date: string | null
  students_on_campus:     boolean | null
  document_type_name:     string | null
  document_other:         string | null
  description:            string | null
  service_start_date:     string | null
  service_end_date:       string | null
  amount:                 number | null
  funding_source:         string | null
  requires_board_approval: boolean
  board_approval_date:    string | null
  is_urgent:              boolean
  urgent_reason:          string | null
}

function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return ''
  try {
    return format(new Date(dateStr), 'MM/dd/yyyy')
  } catch {
    return dateStr
  }
}

function formatCurrency(amount: number | null): string {
  if (amount === null || amount === undefined) return ''
  if (amount < 0) return `($${Math.abs(amount).toLocaleString('en-US', { minimumFractionDigits: 2 })})`
  return `$${amount.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
}

// ── Main generator function ───────────────────────────────────

export async function generateCAFPdf(document: Document): Promise<Uint8Array> {
  // Load the blank CAF template
  const templatePath = process.cwd() + '/public/templates/caf-template.pdf'
  const fs = await import('fs/promises')
  const templateBytes = await fs.readFile(templatePath)

  const pdfDoc = await PDFDocument.load(templateBytes)
  const page = pdfDoc.getPages()[0]
  const { height } = page.getSize()

  const font     = await pdfDoc.embedFont(StandardFonts.Helvetica)
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const black    = rgb(0, 0, 0)
  const blue     = rgb(0, 0, 0.8)

  // Helper: draw text at a named field position
  function drawText(
    field: FieldKey,
    text: string,
    options: { bold?: boolean; size?: number; color?: typeof black } = {}
  ) {
    const [x, y] = FIELD_POSITIONS[field]
    page.drawText(text, {
      x,
      y: height - y,          // flip y (pdf-lib origin is bottom-left)
      size: options.size ?? 9,
      font: options.bold ? fontBold : font,
      color: options.color ?? black,
    })
  }

  // Helper: draw checkbox (filled square for checked)
  function drawCheckbox(field: FieldKey, checked: boolean) {
    if (!checked) return
    const [x, y] = FIELD_POSITIONS[field]
    page.drawRectangle({
      x,
      y: height - y - 1,
      width: 8,
      height: 8,
      color: black,
    })
  }

  // Helper: wrap long text
  function drawWrappedText(
    field: FieldKey,
    text: string,
    maxWidth: number,
    lineHeight: number = 12
  ) {
    const [x, y] = FIELD_POSITIONS[field]
    const words = (text || '').split(' ')
    const lines: string[] = []
    let currentLine = ''

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word
      const textWidth = font.widthOfTextAtSize(testLine, 9)
      if (textWidth > maxWidth && currentLine) {
        lines.push(currentLine)
        currentLine = word
      } else {
        currentLine = testLine
      }
    }
    if (currentLine) lines.push(currentLine)

    lines.slice(0, 8).forEach((line, i) => {  // max 8 lines in description box
      page.drawText(line, {
        x,
        y: height - y - (i * lineHeight),
        size: 9,
        font,
        color: black,
      })
    })
  }

  // ── Fill fields ──────────────────────────────────────────────

  const data: CAFData = {
    date_of_request:            formatDate(document.created_at),
    date_needed_by:             formatDate(document.date_needed_by),
    requester_name_title:       [document.requester_name, document.requester_title]
                                  .filter(Boolean).join(' - '),
    campus_department:          document.campus_name ?? '',
    organization:               document.organization ?? 'IDEA Public Schools Texas',
    vendor_name:                document.vendor_name,
    is_coop_member:             document.is_coop_member,
    coop_name:                  document.coop_name,
    vendor_is_former_employee:  document.vendor_is_former_employee,
    vendor_last_employment_date: formatDate(document.vendor_last_employment_date),
    students_on_campus:         document.students_on_campus,
    document_type_name:         document.document_type_name,
    document_other:             document.document_other,
    description:                document.description,
    service_start_date:         formatDate(document.service_start_date),
    service_end_date:           formatDate(document.service_end_date),
    amount:                     document.amount,
    funding_source:             document.funding_source,
    requires_board_approval:    false, // derived from pipeline + amount check at call site
    board_approval_date:        formatDate(document.board_approval_date),
    is_urgent:                  document.is_urgent ?? false,
    urgent_reason:              document.urgent_reason,
  }

  // Header fields
  drawText('date_of_request',     data.date_of_request)
  if (data.date_needed_by) drawText('date_needed_by', data.date_needed_by)

  // Requester + vendor info
  if (data.requester_name_title) drawText('requester_name_title', data.requester_name_title)
  drawText('campus_department',   data.campus_department)
  drawText('organization',        data.organization)
  if (data.vendor_name)           drawText('vendor_name', data.vendor_name)

  // CO-OP
  drawCheckbox('coop_yes', data.is_coop_member === true)
  drawCheckbox('coop_no',  data.is_coop_member === false)
  if (data.coop_name)             drawText('coop_name', data.coop_name)

  // Former employee
  drawCheckbox('former_emp_yes', data.vendor_is_former_employee === true)
  drawCheckbox('former_emp_no',  data.vendor_is_former_employee === false)
  if (data.vendor_last_employment_date) {
    drawText('former_emp_date', data.vendor_last_employment_date)
  }

  // Students on campus
  drawCheckbox('students_yes', data.students_on_campus === true)
  drawCheckbox('students_no',  data.students_on_campus === false)

  // Document type
  if (data.document_type_name) drawText('doc_type', data.document_type_name)
  if (data.document_other)     drawText('doc_other', data.document_other)

  // Description (wrapped)
  if (data.description) {
    drawWrappedText('description', data.description, 460)
  }

  // Service dates + financials
  if (data.service_start_date) drawText('service_start_date', data.service_start_date)
  if (data.service_end_date)   drawText('service_end_date',   data.service_end_date)
  if (data.amount !== null)    drawText('amount',             formatCurrency(data.amount), { color: blue })
  if (data.funding_source)     drawText('fund_source',        data.funding_source)

  // Section I: Board approval
  drawCheckbox('board_yes', data.requires_board_approval)
  drawCheckbox('board_no',  !data.requires_board_approval)
  if (data.board_approval_date) drawText('board_approval_date', data.board_approval_date)

  // Section II: Urgent
  drawCheckbox('urgent_yes', data.is_urgent)
  drawCheckbox('urgent_no',  !data.is_urgent)
  if (data.is_urgent && data.urgent_reason) {
    drawText('urgent_reason', data.urgent_reason)
  }

  // Section III signature lines are left blank — signed by hand

  const pdfBytes = await pdfDoc.save()
  return pdfBytes
}

// ── API Route Handler ─────────────────────────────────────────

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          cookieStore.set(name, value, options)
        },
        remove(name, options) {
          cookieStore.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch document
  const { data: document, error: docError } = await supabase
    .from('documents')
    .select('*')
    .eq('id', params.id)
    .single()

  if (docError || !document) {
    return NextResponse.json({ error: 'Document not found' }, { status: 404 })
  }

  try {
    // Generate the PDF
    const pdfBytes = await generateCAFPdf(document as Document)

    // Upload to Supabase Storage
    const filename = `caf_${document.id}_${Date.now()}.pdf`
    const storagePath = `organizations/${document.org_id}/caf/${filename}`

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(storagePath, pdfBytes, {
        contentType: 'application/pdf',
        upsert: true,
      })

    if (uploadError) throw uploadError

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('documents')
      .getPublicUrl(storagePath)

    // Update document record with CAF URL and generated timestamp
    await supabase
      .from('documents')
      .update({
        caf_pdf_url: urlData.publicUrl,
        caf_generated_at: new Date().toISOString(),
      })
      .eq('id', params.id)

    return NextResponse.json({
      success: true,
      caf_pdf_url: urlData.publicUrl,
      generated_at: new Date().toISOString(),
    })

  } catch (error) {
    console.error('CAF generation failed:', error)
    return NextResponse.json(
      { error: 'Failed to generate CAF' },
      { status: 500 }
    )
  }
}

// ── GET: Download the generated CAF ──────────────────────────

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const cookieStore = cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name) {
          return cookieStore.get(name)?.value
        },
        set(name, value, options) {
          cookieStore.set(name, value, options)
        },
        remove(name, options) {
          cookieStore.set(name, '', { ...options, maxAge: 0 })
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: document } = await supabase
    .from('documents')
    .select('caf_pdf_url, campus_name, document_type_name, created_at')
    .eq('id', params.id)
    .single()

  if (!document?.caf_pdf_url) {
    return NextResponse.json({ error: 'CAF not yet generated' }, { status: 404 })
  }

  // Redirect to the stored PDF
  return NextResponse.redirect(document.caf_pdf_url)
}
