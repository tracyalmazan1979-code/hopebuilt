'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { DocumentType, Campus } from '@/types'
import { Upload, X, FileText, CheckCircle2 } from 'lucide-react'
import { clsx } from 'clsx'

interface FileUpload {
  label: string
  key: 'caf' | 'budget' | 'document'
  accept: string
  description: string
  url: string | null
  uploading: boolean
}

export function QuickAddForm({
  documentTypes,
  campuses,
}: {
  documentTypes: DocumentType[]
  campuses: Campus[]
}) {
  const router = useRouter()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Form fields — minimal info
  const [campusName, setCampusName] = useState('')
  const [state, setState] = useState('TX')
  const [docTypeId, setDocTypeId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [pipelineStatus, setPipelineStatus] = useState('pending_fc_review')
  const [notes, setNotes] = useState('')

  // File uploads
  const [files, setFiles] = useState<FileUpload[]>([
    { label: 'CAF Form (PDF)', key: 'caf', accept: '.pdf', description: 'Completed & signed CAF', url: null, uploading: false },
    { label: 'Budget Sheet', key: 'budget', accept: '.pdf,.xls,.xlsx', description: 'From IDEA Master Report', url: null, uploading: false },
    { label: 'Contract / Document', key: 'document', accept: '.pdf,.doc,.docx,.xls,.xlsx', description: 'The actual contract or document', url: null, uploading: false },
  ])

  async function handleUpload(key: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setFiles(prev => prev.map(f => f.key === key ? { ...f, uploading: true } : f))

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const path = `uploads/${user?.id}/${Date.now()}_${file.name}`
      const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('documents').getPublicUrl(path)

      setFiles(prev => prev.map(f => f.key === key ? { ...f, url: data.publicUrl, uploading: false } : f))
    } catch (err) {
      setError(`Failed to upload ${key} file. Please try again.`)
      setFiles(prev => prev.map(f => f.key === key ? { ...f, uploading: false } : f))
    }
  }

  function clearFile(key: string) {
    setFiles(prev => prev.map(f => f.key === key ? { ...f, url: null } : f))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!campusName.trim()) { setError('Campus name is required.'); return }

    setSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()

      // Get user's org_id
      const { data: profile } = await supabase
        .from('users')
        .select('org_id')
        .eq('id', user?.id)
        .single()

      // Find doc type name
      const selectedType = documentTypes.find(t => t.id === docTypeId)

      const cafFile = files.find(f => f.key === 'caf')
      const budgetFile = files.find(f => f.key === 'budget')
      const docFile = files.find(f => f.key === 'document')

      const { data: doc, error: insertError } = await supabase
        .from('documents')
        .insert({
          org_id: profile?.org_id,
          campus_name: campusName,
          state,
          document_type_id: docTypeId || null,
          document_type_name: selectedType?.name ?? null,
          amount: amount ? parseFloat(amount) : null,
          description: description || null,
          notes: notes || null,
          pipeline_status: pipelineStatus,
          file_status: docFile?.url ? 'received' : 'pending_doc',
          file_url: docFile?.url ?? null,
          caf_pdf_url: cafFile?.url ?? null,
          budget_sheet_url: budgetFile?.url ?? null,
          created_by: user?.id,
        })
        .select()
        .single()

      if (insertError) throw insertError

      router.push(`/documents/${doc.id}?submitted=1`)
    } catch (err: any) {
      setError(err.message ?? 'Failed to add document. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  const uploadedCount = files.filter(f => f.url).length

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

      {/* File uploads — the main focus */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Upload size={16} className="text-blue-600" />
          <h3 className="font-semibold text-sm text-gray-900">Upload Files</h3>
          {uploadedCount > 0 && (
            <span className="text-[10px] font-bold bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
              {uploadedCount} of 3 uploaded
            </span>
          )}
        </div>

        <div className="grid grid-cols-3 gap-3">
          {files.map(file => (
            <div key={file.key} className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                {file.label}
              </label>
              {file.url ? (
                <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 border border-green-200 min-h-[80px]">
                  <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                  <span className="text-xs text-green-700 flex-1">Uploaded</span>
                  <button
                    type="button"
                    onClick={() => clearFile(file.key)}
                    className="text-gray-400 hover:text-red-500"
                  >
                    <X size={14} />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <input
                    type="file"
                    onChange={e => handleUpload(file.key, e)}
                    disabled={file.uploading}
                    className="absolute inset-0 opacity-0 cursor-pointer z-10"
                    accept={file.accept}
                  />
                  <div className={clsx(
                    'flex flex-col items-center justify-center gap-1.5 p-4 rounded-md border-2 border-dashed transition-colors min-h-[80px]',
                    file.uploading ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                  )}>
                    <FileText size={18} className="text-gray-300" />
                    <div className="text-[11px] text-gray-400 text-center">
                      {file.uploading ? 'Uploading...' : file.description}
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Minimal document info */}
      <div className="card p-5 space-y-4">
        <h3 className="font-semibold text-sm text-gray-900">Document Info</h3>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Campus / Project <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input-base"
              placeholder="e.g. IDEA Henry Ph 2"
              list="campuses-quick"
              value={campusName}
              onChange={e => setCampusName(e.target.value)}
            />
            <datalist id="campuses-quick">
              {campuses.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              State / Region
            </label>
            <select className="input-base" value={state} onChange={e => setState(e.target.value)}>
              <option value="TX">TX</option>
              <option value="FL">FL (IPS)</option>
              <option value="OH">OH (IPS)</option>
              <option value="IPS_FL">IPS / FL</option>
              <option value="TX_IPS">TX & IPS</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Document Type
            </label>
            <select className="input-base" value={docTypeId} onChange={e => setDocTypeId(e.target.value)}>
              <option value="">— Select —</option>
              {documentTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Amount ($)
            </label>
            <input
              type="number"
              step="0.01"
              className="input-base"
              placeholder="0.00"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Pipeline Status
          </label>
          <select className="input-base" value={pipelineStatus} onChange={e => setPipelineStatus(e.target.value)}>
            <option value="pending_fc_review">Pending FC Review</option>
            <option value="pending_coo">Pending COO</option>
            <option value="pending_treasury">Pending Treasury</option>
            <option value="pending_legal">Pending Legal</option>
            <option value="pending_finance_committee">Pending Finance Committee</option>
            <option value="pending_bod">Pending BOD</option>
            <option value="pending_execution">Pending Execution</option>
            <option value="fully_executed">Fully Executed</option>
          </select>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Description
          </label>
          <textarea
            className="input-base min-h-[60px]"
            rows={2}
            placeholder="Brief description (optional)..."
            value={description}
            onChange={e => setDescription(e.target.value)}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
            Notes
          </label>
          <textarea
            className="input-base min-h-[40px]"
            rows={1}
            placeholder="Internal notes (optional)..."
            value={notes}
            onChange={e => setNotes(e.target.value)}
          />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-600">
          {error}
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <div className="text-[11px] text-gray-400">
          {uploadedCount} file{uploadedCount !== 1 ? 's' : ''} attached
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.back()}
            className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="px-5 py-2 text-sm font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50"
          >
            {submitting ? 'Adding...' : 'Add to Tracker'}
          </button>
        </div>
      </div>
    </form>
  )
}
