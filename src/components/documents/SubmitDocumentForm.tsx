'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { createClient } from '@/lib/supabase'
import { submitDocument } from '@/lib/data'
import type { DocumentType, Campus, StateRegion } from '@/types'
import { AlertTriangle, Upload, X, Plus, ChevronDown } from 'lucide-react'
import { clsx } from 'clsx'

// ── Schema ────────────────────────────────────────────────────

const schema = z.object({
  // Required
  state:              z.enum(['TX','FL','OH','IPS_FL','TX_IPS']),
  campus_name:        z.string().min(1, 'Campus is required'),
  document_type_id:   z.string().min(1, 'Document type is required'),
  document_type_other: z.string().optional(),
  description:        z.string().min(10, 'Description must be at least 10 characters'),
  submitter_type:     z.enum(['pmsi','idea_internal']),

  // Optional core
  amount:             z.number().nullable().optional(),
  funding_request:    z.string().optional(),
  funding_source:     z.string().optional(),
  notes:              z.string().optional(),
  meeting_id:         z.string().optional(),

  // CAF fields
  requester_name:     z.string().optional(),
  requester_title:    z.string().optional(),
  organization:       z.string().optional(),
  vendor_name:        z.string().optional(),
  is_coop_member:     z.boolean().optional(),
  coop_name:          z.string().optional(),
  vendor_is_former_employee: z.boolean().optional(),
  vendor_last_day_employment: z.string().optional(),
  students_on_campus: z.boolean().optional(),
  service_start_date: z.string().optional(),
  service_end_date:   z.string().optional(),
  date_needed_by:     z.string().optional(),
  is_urgent:          z.boolean().default(false),
  urgent_reason:      z.string().optional(),

  // COI
  coi_attached:            z.boolean().optional(),
  coi_status_notes:        z.string().optional(),

  // Board approval (Section I of CAF)
  board_approval_required: z.boolean().optional(),
  board_approval_date:     z.string().optional(),

  // File
  file_status:        z.enum(['pending_doc','received','not_required']).default('pending_doc'),
})

type FormValues = z.infer<typeof schema>

// ── Helpers ───────────────────────────────────────────────────

const FUNDING_REQUESTS = [
  'New Request',
  'Amount available within Project Budget',
  'Money coming back to IDEA',
  'Emergency',
  'New Request / Emergency',
]

const FUNDING_SOURCES = [
  '2025 Bond',
  '2024 Bond',
  '2023 Bond',
  'Regions LOC',
  'Cash per JA',
  'Cash per Treasury',
  'SHARS',
  'S&S Cycle 1 Grant',
  'S&S Cycle 2 Grant',
  'Federal Grant',
  'Capex Rollover',
  'Series 2022 Morgan Stanley/Building Hope',
  'Campus Facilities',
  'Principal DISC',
  'TBD',
  'Other',
]

const ORGANIZATIONS = [
  'IDEA Public Schools Texas',
  'IPS Enterprises Inc',
  'IDEA Public Schools Florida',
]

// ── Form field components ─────────────────────────────────────

function Field({ label, required, error, children }: {
  label:     string
  required?: boolean
  error?:    string
  children:  React.ReactNode
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
        {label} {required && <span className="text-amber-400">*</span>}
      </label>
      {children}
      {error && <p className="text-[11px] text-red-400">{error}</p>}
    </div>
  )
}

function Input({ ...props }: React.InputHTMLAttributes<HTMLInputElement>) {
  return <input className="input-base" {...props} />
}

function Select({ children, ...props }: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select className="input-base appearance-none cursor-pointer" {...props}>
      {children}
    </select>
  )
}

function Textarea({ ...props }: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className="input-base min-h-[80px]" {...props} />
}

// ── PMSI Personnel Selector ───────────────────────────────────

const PMSI_PERSONNEL = [
  { name: 'Andrew Stanton', email: 'andrew@pmsi.com' },
  { name: 'Tracy Almazan', email: 'talmazan@pmsitx.com' },
  { name: 'Stephanie (PMSI)', email: 'stephanie@pmsi.com' },
  { name: 'Bob (PMSI)', email: 'bob@pmsi.com' },
]

function PMSIPersonnelSelector({
  selected,
  onChange,
}: {
  selected: string[]
  onChange: (emails: string[]) => void
}) {
  function toggle(email: string) {
    if (selected.includes(email)) {
      onChange(selected.filter(e => e !== email))
    } else {
      onChange([...selected, email])
    }
  }

  return (
    <div className="space-y-2">
      <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
        PMSI Personnel to CC on Submission Email
      </label>
      <div className="flex flex-wrap gap-2">
        {PMSI_PERSONNEL.map(person => (
          <button
            key={person.email}
            type="button"
            onClick={() => toggle(person.email)}
            className={clsx(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-colors',
              selected.includes(person.email)
                ? 'bg-amber-500/15 border-amber-500/40 text-amber-400'
                : 'bg-surface-2 border-default text-muted hover:text-default hover:border-strong'
            )}
          >
            {selected.includes(person.email) && <X size={10} />}
            {person.name}
          </button>
        ))}
      </div>
      <p className="text-[10px] text-dim">
        Vanessa and Sylvia are always included. Select additional PMSI staff for this document.
      </p>
    </div>
  )
}

// ── Auto-flag banner ──────────────────────────────────────────

function AutoFlags({
  flags,
}: {
  flags: { bod: boolean; legal: boolean; urgent: boolean; background: boolean }
}) {
  const active = [
    flags.bod       && { label: 'BOD Approval Required',       color: 'purple', reason: 'Amount exceeds $50K or document type requires board approval' },
    flags.legal     && { label: 'Legal Review Required',        color: 'orange', reason: 'Document type requires legal review' },
    flags.urgent    && { label: 'Urgent Request',               color: 'red',    reason: 'Marked as urgent — include reason below' },
    flags.background && { label: 'Background Check May Apply', color: 'amber',  reason: 'Service provider will be on campus with students' },
  ].filter(Boolean) as { label: string; color: string; reason: string }[]

  if (active.length === 0) return null

  return (
    <div className="rounded-lg border border-amber-500/30 bg-amber-500/8 p-3 space-y-2">
      <div className="flex items-center gap-2 text-[11px] font-bold text-amber-400 uppercase tracking-wider">
        <AlertTriangle size={13} /> Auto-detected flags
      </div>
      {active.map(flag => (
        <div key={flag.label} className="flex items-start gap-2">
          <span className={clsx('text-[10px] font-bold px-2 py-0.5 rounded-full mt-0.5 flex-shrink-0', {
            'bg-purple-500/15 text-purple-400': flag.color === 'purple',
            'bg-orange-500/15 text-orange-400': flag.color === 'orange',
            'bg-red-500/15 text-red-400':       flag.color === 'red',
            'bg-amber-500/15 text-amber-400':   flag.color === 'amber',
          })}>
            {flag.label}
          </span>
          <span className="text-[11px] text-muted">{flag.reason}</span>
        </div>
      ))}
    </div>
  )
}

// ── Typed Signature ───────────────────────────────────────────

interface SignatureData {
  name: string
  title: string
  date: string
}

function TypedSignatureField({
  onChange,
  value,
}: {
  onChange: (sig: SignatureData) => void
  value: SignatureData
}) {
  const today = new Date().toISOString().split('T')[0]

  return (
    <div className="space-y-3">
      <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
        Submitter Signature <span className="text-amber-400">*</span>
      </label>
      <div className="card p-4 space-y-3 border-amber-500/20">
        <div className="grid grid-cols-3 gap-3">
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-dim uppercase">Full Name</label>
            <input
              type="text"
              className="input-base"
              placeholder="First Last"
              value={value.name}
              onChange={e => onChange({ ...value, name: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-dim uppercase">Title</label>
            <input
              type="text"
              className="input-base"
              placeholder="Project Manager"
              value={value.title}
              onChange={e => onChange({ ...value, title: e.target.value })}
            />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-semibold text-dim uppercase">Date</label>
            <input
              type="date"
              className="input-base"
              value={value.date}
              onChange={e => onChange({ ...value, date: e.target.value })}
            />
          </div>
        </div>
        {value.name && (
          <div className="border-t border-default pt-3">
            <div className="text-[10px] text-dim uppercase mb-1">Preview</div>
            <div className="font-serif italic text-lg text-default">{value.name}</div>
            <div className="text-[11px] text-muted">{value.title}</div>
            <div className="text-[11px] text-muted">{value.date}</div>
          </div>
        )}
      </div>
      <p className="text-[10px] text-dim">
        By typing your name, you are electronically signing this CAF submission.
      </p>
    </div>
  )
}

// ── Main Form ─────────────────────────────────────────────────

export function SubmitDocumentForm({
  documentTypes,
  campuses,
  meetings,
}: {
  documentTypes: DocumentType[]
  campuses:      Campus[]
  meetings:      { id: string; title: string | null; meeting_date: string }[]
}) {
  const router = useRouter()
  const [pmsiCCEmails,   setPmsiCCEmails]   = useState<string[]>([])
  const [pmsiCCNames,    setPmsiCCNames]     = useState<string[]>([])
  const [fileUrl,        setFileUrl]         = useState<string | null>(null)
  const [budgetFileUrl,  setBudgetFileUrl]   = useState<string | null>(null)
  const [uploading,      setUploading]       = useState(false)
  const [uploadingBudget, setUploadingBudget] = useState(false)
  const [submitting,     setSubmitting]      = useState(false)
  const [error,          setError]           = useState<string | null>(null)
  const [section,        setSection]         = useState<'basic'|'caf'|'urgency'>('basic')
  const [isOtherType,    setIsOtherType]     = useState(false)
  const [isCoop,         setIsCoop]          = useState(false)
  const [signatureData,  setSignatureData]   = useState<SignatureData>({
    name: '', title: '', date: new Date().toISOString().split('T')[0],
  })

  const { register, handleSubmit, watch, setValue, formState: { errors } } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      state:          'TX',
      submitter_type: 'pmsi',
      is_urgent:      false,
      file_status:    'pending_doc',
    },
  })

  const watchedTypeId   = watch('document_type_id')
  const watchedAmount   = watch('amount')
  const watchedUrgent   = watch('is_urgent')
  const watchedStudents = watch('students_on_campus')
  const watchedCoop     = watch('is_coop_member')
  const watchedSubmitter = watch('submitter_type')

  // Find selected doc type
  const selectedType = watchedTypeId === 'other' ? null : documentTypes.find(t => t.id === watchedTypeId)

  // Auto-flags
  const flags = {
    bod:        (selectedType?.requires_bod ?? false) || ((watchedAmount ?? 0) > 50000),
    legal:      selectedType?.requires_legal ?? false,
    urgent:     watchedUrgent,
    background: watchedStudents === true,
  }

  // File upload
  async function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const path = `uploads/${user?.id}/${Date.now()}_${file.name}`
      const { error } = await supabase.storage.from('documents').upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from('documents').getPublicUrl(path)
      setFileUrl(data.publicUrl)
      setValue('file_status', 'received')
    } catch (err) {
      setError('File upload failed. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  // Budget sheet upload
  async function handleBudgetUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingBudget(true)
    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const path = `uploads/${user?.id}/${Date.now()}_budget_${file.name}`
      const { error } = await supabase.storage.from('documents').upload(path, file)
      if (error) throw error
      const { data } = supabase.storage.from('documents').getPublicUrl(path)
      setBudgetFileUrl(data.publicUrl)
    } catch (err) {
      setError('Budget sheet upload failed. Please try again.')
    } finally {
      setUploadingBudget(false)
    }
  }

  async function onSubmit(values: FormValues) {
    if (!signatureData.name.trim()) {
      setError('Please type your name to sign the form before submitting.')
      setSection('urgency')
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const doc = await submitDocument({
        ...values,
        document_type_id:   values.document_type_id === 'other' ? undefined : values.document_type_id,
        document_type_name: values.document_type_id === 'other' ? values.document_type_other : undefined,
        campus_id:    campuses.find(c => c.name === values.campus_name)?.id,
        file_status:  fileUrl ? 'received' : 'pending_doc',
        file_url:     fileUrl ?? undefined,
        budget_sheet_url: budgetFileUrl ?? undefined,
        pmsi_personnel_emails: pmsiCCEmails,
        pmsi_personnel_names:  pmsiCCNames,
        submitter_signature_name:  signatureData.name,
        submitter_signature_title: signatureData.title,
        submitter_signature_date:  signatureData.date,
      } as any)

      // Fire submission email
      await fetch(`/api/documents/${doc.id}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file_status:           fileUrl ? 'received' : 'pending_doc',
          pmsi_personnel_emails: pmsiCCEmails,
          pmsi_personnel_names:  pmsiCCNames,
        }),
      })

      router.push(`/documents/${doc.id}?submitted=1`)
    } catch (err: any) {
      setError(err.message ?? 'Submission failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-6 max-w-3xl">

      {/* Section tabs */}
      <div className="flex rounded-lg overflow-hidden border border-default text-xs font-semibold">
        {(['basic','caf','urgency'] as const).map(s => (
          <button
            key={s}
            type="button"
            onClick={() => setSection(s)}
            className={clsx(
              'flex-1 py-2.5 transition-colors capitalize',
              section === s
                ? 'bg-amber-500/15 text-amber-400 border-b-2 border-amber-400'
                : 'text-muted hover:text-default'
            )}
          >
            {s === 'basic' ? '1. Document Info' : s === 'caf' ? '2. CAF Details' : '3. Urgency & Vendor'}
          </button>
        ))}
      </div>

      {/* Section 1: Basic Info */}
      {section === 'basic' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Submitted By" required>
              <Select {...register('submitter_type')}>
                <option value="pmsi">PMSI (PMSI-managed project)</option>
                <option value="idea_internal">IDEA Internal (IDEA-managed project)</option>
              </Select>
            </Field>
            <Field label="State / Region" required>
              <Select {...register('state')}>
                <option value="TX">TX</option>
                <option value="FL">FL (IPS)</option>
                <option value="OH">OH (IPS)</option>
                <option value="IPS_FL">IPS / FL</option>
                <option value="TX_IPS">TX & IPS</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Campus / Project Name" required error={errors.campus_name?.message}>
              <Input
                list="campuses-list"
                placeholder="e.g. IDEA Henry Ph 2, IPS Lakeland…"
                {...register('campus_name')}
              />
              <datalist id="campuses-list">
                {campuses.map(c => <option key={c.id} value={c.name} />)}
              </datalist>
            </Field>
            <Field label="FAC Meeting" >
              <Select {...register('meeting_id')}>
                <option value="">— Select meeting (optional) —</option>
                {meetings.map(m => (
                  <option key={m.id} value={m.id}>
                    {m.title ?? m.meeting_date}
                  </option>
                ))}
              </Select>
            </Field>
          </div>

          <Field label="Document Type" required error={errors.document_type_id?.message}>
            <select
              className="input-base appearance-none cursor-pointer"
              {...register('document_type_id', {
                onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setIsOtherType(e.target.value === 'other'),
              })}
            >
              <option value="">— Select document type —</option>
              {documentTypes.map(t => (
                <option key={t.id} value={t.id}>{t.name}</option>
              ))}
              <option value="other">Other (type in below)</option>
            </select>
          </Field>
          {isOtherType && (
            <Field label="Other Document Type" required>
              <Input
                placeholder="Enter document type name…"
                {...register('document_type_other')}
              />
            </Field>
          )}

          <Field label="Description of Services" required error={errors.description?.message}>
            <Textarea
              rows={5}
              placeholder="Full description of scope, purpose, and key context…"
              {...register('description')}
            />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Amount ($)">
              <Input
                type="number"
                step="0.01"
                placeholder="0.00"
                {...register('amount', { valueAsNumber: true })}
              />
            </Field>
            <Field label="Funding Request">
              <Select {...register('funding_request')}>
                <option value="">— Select —</option>
                {FUNDING_REQUESTS.map(r => <option key={r} value={r}>{r}</option>)}
              </Select>
            </Field>
          </div>

          <Field label="Funding Source (Account String)">
            <Input
              list="funding-sources"
              placeholder="e.g. 2025 Bond, Cash per JA, Grant Funds…"
              {...register('funding_source')}
            />
            <datalist id="funding-sources">
              {FUNDING_SOURCES.map(s => <option key={s} value={s} />)}
            </datalist>
            <p className="text-[10px] text-dim mt-1">
              Combined with Funding Request on CAF as: <span className="text-amber-400/70">Source (Request Type)</span> — e.g. &quot;2025 Bond (Amount available within Project Budget)&quot;
            </p>
          </Field>

          <Field label="Submitter Notes (internal)">
            <Textarea
              rows={2}
              placeholder="Any notes for Vanessa / the team…"
              {...register('notes')}
            />
          </Field>

          {/* File upload */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Document File
            </label>
            {fileUrl ? (
              <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/20">
                <span className="text-xs text-green-400 flex-1 truncate">✓ File uploaded</span>
                <button
                  type="button"
                  onClick={() => { setFileUrl(null); setValue('file_status', 'pending_doc') }}
                  className="text-dim hover:text-red-400"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={uploading}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  accept=".pdf,.doc,.docx,.xls,.xlsx"
                />
                <div className={clsx(
                  'flex flex-col items-center justify-center gap-2 p-6 rounded-md border-2 border-dashed transition-colors',
                  uploading ? 'border-amber-500/40 bg-amber-500/5' : 'border-default hover:border-amber-500/40 hover:bg-surface-2'
                )}>
                  <Upload size={20} className="text-dim" />
                  <div className="text-center">
                    <div className="text-xs font-semibold text-muted">
                      {uploading ? 'Uploading…' : 'Click or drag to upload document'}
                    </div>
                    <div className="text-[10px] text-dim mt-0.5">PDF, DOC, DOCX, XLS, XLSX</div>
                  </div>
                </div>
              </div>
            )}
            {!fileUrl && (
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="pending-doc"
                  checked
                  readOnly
                  className="rounded"
                />
                <label htmlFor="pending-doc" className="text-[11px] text-amber-400 font-semibold">
                  Submit as PENDING DOC — document file will follow
                </label>
              </div>
            )}
          </div>

          {/* Budget sheet upload */}
          <div className="space-y-2">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wider">
              Budget Sheet (from IDEA Master Report)
            </label>
            {budgetFileUrl ? (
              <div className="flex items-center gap-2 p-3 rounded-md bg-green-500/10 border border-green-500/20">
                <span className="text-xs text-green-400 flex-1 truncate">✓ Budget sheet uploaded</span>
                <button
                  type="button"
                  onClick={() => setBudgetFileUrl(null)}
                  className="text-dim hover:text-red-400"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <div className="relative">
                <input
                  type="file"
                  onChange={handleBudgetUpload}
                  disabled={uploadingBudget}
                  className="absolute inset-0 opacity-0 cursor-pointer z-10"
                  accept=".pdf,.xls,.xlsx"
                />
                <div className={clsx(
                  'flex flex-col items-center justify-center gap-2 p-4 rounded-md border-2 border-dashed transition-colors',
                  uploadingBudget ? 'border-amber-500/40 bg-amber-500/5' : 'border-default hover:border-amber-500/40 hover:bg-surface-2'
                )}>
                  <Upload size={16} className="text-dim" />
                  <div className="text-center">
                    <div className="text-xs font-semibold text-muted">
                      {uploadingBudget ? 'Uploading…' : 'Attach budget sheet PDF'}
                    </div>
                    <div className="text-[10px] text-dim mt-0.5">PDF from IDEA Master Report (print to PDF)</div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* PMSI personnel */}
          {watchedSubmitter === 'pmsi' && (
            <PMSIPersonnelSelector
              selected={pmsiCCEmails}
              onChange={emails => {
                setPmsiCCEmails(emails)
                setPmsiCCNames(emails.map(e => PMSI_PERSONNEL.find(p => p.email === e)?.name ?? e))
              }}
            />
          )}

          <AutoFlags flags={flags} />
        </div>
      )}

      {/* Section 2: CAF Details */}
      {section === 'caf' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Requester Name">
              <Input placeholder="First Last" {...register('requester_name')} />
            </Field>
            <Field label="Requester Title">
              <Input placeholder="Director of Construction" {...register('requester_title')} />
            </Field>
          </div>

          <Field label="Organization">
            <Select {...register('organization')}>
              <option value="">— Select —</option>
              {ORGANIZATIONS.map(o => <option key={o} value={o}>{o}</option>)}
            </Select>
          </Field>

          <Field label="Vendor Name">
            <Input placeholder="Vendor or contractor name" {...register('vendor_name')} />
          </Field>

          <div className="grid grid-cols-2 gap-4">
            <Field label="COI (Certificate of Insurance) Attached?">
              <select
                className="input-base appearance-none cursor-pointer"
                {...register('coi_attached', {
                  setValueAs: v => v === 'true' ? true : v === 'false' ? false : undefined,
                })}
              >
                <option value="">— Select —</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </Field>
            {watch('coi_attached') === false && (
              <Field label="COI Status Notes" required>
                <Input
                  placeholder="e.g. Requested from vendor, expected by…"
                  {...register('coi_status_notes')}
                />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="CO-OP Member?">
              <select
                className="input-base appearance-none cursor-pointer"
                {...register('is_coop_member', {
                  setValueAs: v => v === 'true' ? true : v === 'false' ? false : undefined,
                  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => setIsCoop(e.target.value === 'true'),
                })}
              >
                <option value="">— Select —</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </Field>
            {isCoop && (
              <Field label="If YES, which one?">
                <Input placeholder="BuyBoard, TIPS, Region 19…" {...register('coop_name')} />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Vendor is a Former Employee?">
              <select
                className="input-base appearance-none cursor-pointer"
                {...register('vendor_is_former_employee', {
                  setValueAs: v => v === 'true' ? true : v === 'false' ? false : undefined,
                })}
              >
                <option value="">— Select —</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </Field>
            {watch('vendor_is_former_employee') === true && (
              <Field label="Last Day of Employment">
                <Input type="date" {...register('vendor_last_day_employment')} />
              </Field>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Students On Campus During Service?">
              <Select {...register('students_on_campus', { setValueAs: v => v === 'true' ? true : v === 'false' ? false : undefined })}>
                <option value="">— Select —</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </Select>
            </Field>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Field label="Service Start Date">
              <Input type="date" {...register('service_start_date')} />
            </Field>
            <Field label="Service End Date">
              <Input type="date" {...register('service_end_date')} />
            </Field>
          </div>
        </div>
      )}

      {/* Section I: Board Approval */}
      {section === 'caf' && (
        <div className="card p-4 space-y-3 mt-4">
          <div className="font-syne font-bold text-xs uppercase tracking-wider text-muted">
            Section I — Board Approval Required?
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Board Approval Required?">
              <select
                className="input-base appearance-none cursor-pointer"
                {...register('board_approval_required', {
                  setValueAs: v => v === 'true' ? true : v === 'false' ? false : undefined,
                })}
              >
                <option value="">— Select —</option>
                <option value="true">Yes</option>
                <option value="false">No</option>
              </select>
            </Field>
            {watch('board_approval_required') && (
              <Field label="Date of Board Approval">
                <Input type="date" {...register('board_approval_date')} />
              </Field>
            )}
          </div>
          <div className="text-[11px] text-muted">
            <div className="font-semibold mb-1">Criteria:</div>
            <ul className="list-disc list-inside space-y-0.5 text-dim">
              <li>Above $250K & not part of a COOP</li>
              <li>Contract funding not originally budgeted for</li>
              <li>Multiyear contract</li>
              <li>Real Estate contract / Rental of space outside our premises</li>
              <li>Public works contracts above $50K (Facilities & Construction projects)</li>
              <li>Capital assets (CapEx): cost + service/installation above $5K p/unit basis</li>
            </ul>
          </div>
        </div>
      )}

      {/* Section 3: Urgency */}
      {section === 'urgency' && (
        <div className="space-y-4 animate-fade-in">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Urgent Request?">
              <Select {...register('is_urgent', { setValueAs: v => v === 'true' })}>
                <option value="false">No</option>
                <option value="true">Yes</option>
              </Select>
            </Field>
            <Field label="Date Needed By">
              <Input type="date" {...register('date_needed_by')} />
            </Field>
          </div>

          {watchedUrgent && (
            <Field label="Urgent Reason" required>
              <Textarea
                rows={3}
                placeholder="Explain why this is urgent and the deadline…"
                {...register('urgent_reason')}
              />
            </Field>
          )}

          {/* Signature */}
          <div className="pt-4 border-t border-default">
            <TypedSignatureField
              value={signatureData}
              onChange={setSignatureData}
            />
            {!signatureData.name.trim() && (
              <p className="text-[11px] text-amber-400 mt-1">
                Signature is required before submitting
              </p>
            )}
          </div>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-3 rounded-md bg-red-500/10 border border-red-500/20 text-sm text-red-400">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2 border-t border-default">
        <div className="text-[11px] text-dim">
          Submitting as {watchedSubmitter === 'pmsi' ? 'PMSI' : 'IDEA Internal'} ·{' '}
          {fileUrl ? 'File attached ✓' : 'PENDING DOC — no file yet'}
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm text-muted hover:text-default border border-default rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 text-sm font-bold bg-amber-500 text-black rounded-md hover:bg-amber-400 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Submitting…' : 'Submit Document →'}
          </button>
        </div>
      </div>

    </form>
  )
}
