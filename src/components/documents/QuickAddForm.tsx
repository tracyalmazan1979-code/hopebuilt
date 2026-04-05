'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase'
import type { DocumentType, Campus } from '@/types'
import { Upload, X, FileText, CheckCircle2, Sparkles, Loader2 } from 'lucide-react'
import { clsx } from 'clsx'

interface ExtractedData {
  campus_name?: string
  state?: string
  document_type_name?: string
  amount?: number
  description?: string
  vendor_name?: string
  funding_source?: string
  requester_name?: string
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

  // Upload mode
  const [uploadMode, setUploadMode] = useState<'single' | 'separate'>('single')

  // Single file
  const [singleFileUrl, setSingleFileUrl] = useState<string | null>(null)
  const [singleFileName, setSingleFileName] = useState<string | null>(null)
  const [uploadingSingle, setUploadingSingle] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [extracted, setExtracted] = useState(false)

  // Separate files
  const [cafUrl, setCafUrl] = useState<string | null>(null)
  const [budgetUrl, setBudgetUrl] = useState<string | null>(null)
  const [docUrl, setDocUrl] = useState<string | null>(null)
  const [uploadingKey, setUploadingKey] = useState<string | null>(null)

  // Form fields
  const [campusName, setCampusName] = useState('')
  const [state, setState] = useState('TX')
  const [docTypeId, setDocTypeId] = useState('')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [pipelineStatus, setPipelineStatus] = useState('pending_fc_review')
  const [notes, setNotes] = useState('')
  const [vendorName, setVendorName] = useState('')
  const [fundingSource, setFundingSource] = useState('')
  const [requesterName, setRequesterName] = useState('')
  // Tracker columns
  const [fcDate, setFcDate] = useState('')
  const [budgetAmendmentReqd, setBudgetAmendmentReqd] = useState(false)
  const [bodItemType, setBodItemType] = useState('')
  const [dateSentViaAdobe, setDateSentViaAdobe] = useState('')
  const [dateApprovedSentOut, setDateApprovedSentOut] = useState('')
  const [wetSignatureNotary, setWetSignatureNotary] = useState('')

  // Upload a file to Supabase storage — returns the storage path (not a public URL)
  async function uploadFile(file: File): Promise<string> {
    const supabase = createClient()
    const { data: { user } } = await supabase.auth.getUser()
    const path = `uploads/${user?.id}/${Date.now()}_${file.name}`
    const { error: uploadError } = await supabase.storage.from('documents').upload(path, file)
    if (uploadError) throw uploadError
    return path
  }

  // Single file upload + AI extraction
  async function handleSingleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingSingle(true)
    setError(null)

    try {
      // Upload file
      const url = await uploadFile(file)
      setSingleFileUrl(url)
      setSingleFileName(file.name)
      setUploadingSingle(false)

      // Try AI extraction
      setExtracting(true)
      const formData = new FormData()
      formData.append('file', file)

      const res = await fetch('/api/extract-document', {
        method: 'POST',
        body: formData,
      })

      if (res.ok) {
        const data: ExtractedData = await res.json()
        // Pre-fill form fields
        if (data.campus_name) setCampusName(data.campus_name)
        if (data.state) setState(data.state)
        if (data.amount) setAmount(String(data.amount))
        if (data.description) setDescription(data.description)
        if (data.vendor_name) setVendorName(data.vendor_name)
        if (data.funding_source) setFundingSource(data.funding_source)
        if (data.requester_name) setRequesterName(data.requester_name)

        // Try to match doc type
        if (data.document_type_name) {
          const match = documentTypes.find(t =>
            t.name.toLowerCase().includes(data.document_type_name!.toLowerCase()) ||
            data.document_type_name!.toLowerCase().includes(t.name.toLowerCase())
          )
          if (match) setDocTypeId(match.id)
        }

        setExtracted(true)
      }
    } catch (err) {
      setError('File upload failed. Please try again.')
    } finally {
      setUploadingSingle(false)
      setExtracting(false)
    }
  }

  // Separate file upload
  async function handleSeparateUpload(key: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingKey(key)
    try {
      const url = await uploadFile(file)
      if (key === 'caf') setCafUrl(url)
      else if (key === 'budget') setBudgetUrl(url)
      else setDocUrl(url)
    } catch (err) {
      setError(`Failed to upload file. Please try again.`)
    } finally {
      setUploadingKey(null)
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!campusName.trim()) { setError('Campus name is required.'); return }

    setSubmitting(true)
    setError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      const { data: profile } = await supabase.from('users').select('org_id').eq('id', user?.id).single()

      const selectedType = documentTypes.find(t => t.id === docTypeId)

      // Determine file URLs based on mode
      const fileUrl = uploadMode === 'single' ? singleFileUrl : (docUrl ?? singleFileUrl)
      const cafPdfUrl = uploadMode === 'single' ? singleFileUrl : (cafUrl ?? null)
      const budgetSheetUrl = uploadMode === 'single' ? null : (budgetUrl ?? null)

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
          file_status: fileUrl ? 'received' : 'pending_doc',
          file_url: fileUrl,
          caf_pdf_url: cafPdfUrl,
          budget_sheet_url: budgetSheetUrl,
          vendor_name: vendorName || null,
          funding_source: fundingSource || null,
          presenter_name: requesterName || null,
          fc_date: fcDate || null,
          budget_amendment_reqd: budgetAmendmentReqd,
          bod_item_type: bodItemType || null,
          date_sent_via_adobe: dateSentViaAdobe || null,
          date_approved_sent_out: dateApprovedSentOut || null,
          wet_signature_notary: wetSignatureNotary || null,
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

  return (
    <form onSubmit={handleSubmit} className="space-y-6 max-w-3xl">

      {/* Upload mode toggle */}
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setUploadMode('single')}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all',
            uploadMode === 'single'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-white text-gray-500 border border-gray-200 hover:text-gray-700'
          )}
        >
          <FileText size={13} /> Single File (All-in-One)
        </button>
        <button
          type="button"
          onClick={() => setUploadMode('separate')}
          className={clsx(
            'flex items-center gap-2 px-3 py-2 rounded-md text-xs font-semibold transition-all',
            uploadMode === 'separate'
              ? 'bg-blue-50 text-blue-700 border border-blue-200'
              : 'bg-white text-gray-500 border border-gray-200 hover:text-gray-700'
          )}
        >
          <Upload size={13} /> Separate Files (CAF + Budget + Doc)
        </button>
      </div>

      {/* Single file upload */}
      {uploadMode === 'single' && (
        <div className="card p-5 space-y-3">
          <div className="flex items-center gap-2">
            <FileText size={16} className="text-blue-600" />
            <h3 className="font-semibold text-sm text-gray-900">Upload Document Package</h3>
          </div>
          <p className="text-xs text-gray-500">
            Upload your complete PDF (CAF + contract combined). The app will extract the document info automatically.
          </p>

          {singleFileUrl ? (
            <div className="flex items-center gap-3 p-4 rounded-md bg-green-50 border border-green-200">
              <CheckCircle2 size={18} className="text-green-600 flex-shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-sm font-medium text-green-800 truncate">{singleFileName}</div>
                {extracted && (
                  <div className="flex items-center gap-1 mt-1">
                    <Sparkles size={11} className="text-blue-500" />
                    <span className="text-[11px] text-blue-600 font-medium">Info extracted — review below</span>
                  </div>
                )}
                {extracting && (
                  <div className="flex items-center gap-1 mt-1">
                    <Loader2 size={11} className="text-blue-500 animate-spin" />
                    <span className="text-[11px] text-blue-500">Extracting document info...</span>
                  </div>
                )}
              </div>
              <button
                type="button"
                onClick={() => { setSingleFileUrl(null); setSingleFileName(null); setExtracted(false) }}
                className="text-gray-400 hover:text-red-500"
              >
                <X size={16} />
              </button>
            </div>
          ) : (
            <div className="relative">
              <input
                type="file"
                onChange={handleSingleUpload}
                disabled={uploadingSingle}
                className="absolute inset-0 opacity-0 cursor-pointer z-10"
                accept=".pdf"
              />
              <div className={clsx(
                'flex flex-col items-center justify-center gap-2 p-8 rounded-lg border-2 border-dashed transition-colors',
                uploadingSingle ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
              )}>
                <Upload size={28} className="text-gray-300" />
                <div className="text-sm font-medium text-gray-500">
                  {uploadingSingle ? 'Uploading...' : 'Drop your PDF here or click to browse'}
                </div>
                <div className="text-[11px] text-gray-400">
                  Signed CAF with contract — we'll extract the details
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Separate file uploads */}
      {uploadMode === 'separate' && (
        <div className="card p-5 space-y-4">
          <div className="flex items-center gap-2">
            <Upload size={16} className="text-blue-600" />
            <h3 className="font-semibold text-sm text-gray-900">Upload Files</h3>
          </div>

          <div className="grid grid-cols-3 gap-3">
            {[
              { key: 'caf', label: 'CAF Form (PDF)', desc: 'Completed & signed CAF', accept: '.pdf', url: cafUrl, setUrl: setCafUrl },
              { key: 'budget', label: 'Budget Sheet', desc: 'From IDEA Master Report', accept: '.pdf,.xls,.xlsx', url: budgetUrl, setUrl: setBudgetUrl },
              { key: 'document', label: 'Contract / Document', desc: 'The actual contract', accept: '.pdf,.doc,.docx', url: docUrl, setUrl: setDocUrl },
            ].map(file => (
              <div key={file.key} className="space-y-1.5">
                <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
                  {file.label}
                </label>
                {file.url ? (
                  <div className="flex items-center gap-2 p-3 rounded-md bg-green-50 border border-green-200 min-h-[80px]">
                    <CheckCircle2 size={16} className="text-green-600 flex-shrink-0" />
                    <span className="text-xs text-green-700 flex-1">Uploaded</span>
                    <button type="button" onClick={() => file.setUrl(null)} className="text-gray-400 hover:text-red-500">
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="relative">
                    <input
                      type="file"
                      onChange={e => handleSeparateUpload(file.key, e)}
                      disabled={uploadingKey === file.key}
                      className="absolute inset-0 opacity-0 cursor-pointer z-10"
                      accept={file.accept}
                    />
                    <div className={clsx(
                      'flex flex-col items-center justify-center gap-1.5 p-4 rounded-md border-2 border-dashed transition-colors min-h-[80px]',
                      uploadingKey === file.key ? 'border-blue-300 bg-blue-50' : 'border-gray-200 hover:border-blue-300 hover:bg-gray-50'
                    )}>
                      <FileText size={18} className="text-gray-300" />
                      <div className="text-[11px] text-gray-400 text-center">
                        {uploadingKey === file.key ? 'Uploading...' : file.desc}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Document info */}
      <div className="card p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-sm text-gray-900">Document Info</h3>
          {extracted && (
            <span className="flex items-center gap-1 text-[11px] text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">
              <Sparkles size={10} /> Auto-filled from PDF
            </span>
          )}
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">
              Campus / Project <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              className="input-base"
              placeholder="e.g. IDEA Pharr Ph 3"
              list="campuses-quick"
              value={campusName}
              onChange={e => setCampusName(e.target.value)}
            />
            <datalist id="campuses-quick">
              {campuses.map(c => <option key={c.id} value={c.name} />)}
            </datalist>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">State / Region</label>
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
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Document Type</label>
            <select className="input-base" value={docTypeId} onChange={e => setDocTypeId(e.target.value)}>
              <option value="">— Select —</option>
              {documentTypes.map(t => <option key={t.id} value={t.id}>{t.name}</option>)}
            </select>
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Amount ($)</label>
            <input type="number" step="0.01" className="input-base" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Vendor Name</label>
            <input type="text" className="input-base" placeholder="Vendor or contractor" value={vendorName} onChange={e => setVendorName(e.target.value)} />
          </div>

          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Requester</label>
            <input type="text" className="input-base" placeholder="Who requested this" value={requesterName} onChange={e => setRequesterName(e.target.value)} />
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Funding Source</label>
          <input type="text" className="input-base" placeholder="e.g. 2025 Bond, Cash per JA" value={fundingSource} onChange={e => setFundingSource(e.target.value)} />
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Pipeline Status</label>
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
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Description</label>
          <textarea className="input-base min-h-[60px]" rows={2} placeholder="Brief description..." value={description} onChange={e => setDescription(e.target.value)} />
        </div>

        {/* Tracker columns */}
        <div className="pt-3 mt-3 border-t border-gray-100">
          <div className="text-[11px] font-bold text-gray-400 uppercase tracking-wider mb-3">Tracker Fields (Optional)</div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">FC Date</label>
              <input type="date" className="input-base" value={fcDate} onChange={e => setFcDate(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">BOD Item Type</label>
              <input type="text" className="input-base" placeholder="Consent / Action / Ratification" value={bodItemType} onChange={e => setBodItemType(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Date Sent via Adobe</label>
              <input type="date" className="input-base" value={dateSentViaAdobe} onChange={e => setDateSentViaAdobe(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Date Approved / Sent Out</label>
              <input type="date" className="input-base" value={dateApprovedSentOut} onChange={e => setDateApprovedSentOut(e.target.value)} />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 mt-4">
            <div className="space-y-1.5">
              <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">WET Signature / Notary</label>
              <input type="text" className="input-base" placeholder="e.g. Notary required" value={wetSignatureNotary} onChange={e => setWetSignatureNotary(e.target.value)} />
            </div>
            <div className="flex items-center gap-2 pt-6">
              <input type="checkbox" id="budget_amendment_qa" checked={budgetAmendmentReqd} onChange={e => setBudgetAmendmentReqd(e.target.checked)} className="w-4 h-4" />
              <label htmlFor="budget_amendment_qa" className="text-xs font-semibold text-gray-700">Budget Amendment Required</label>
            </div>
          </div>
        </div>

        <div className="space-y-1.5">
          <label className="text-[11px] font-semibold text-gray-500 uppercase tracking-wider">Notes</label>
          <textarea className="input-base min-h-[40px]" rows={1} placeholder="Internal notes..." value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-red-50 border border-red-200 text-sm text-red-600">{error}</div>
      )}

      <div className="flex items-center justify-between pt-2">
        <div className="text-[11px] text-gray-400">
          {(singleFileUrl || cafUrl || docUrl) ? 'File attached' : 'No file yet'}
        </div>
        <div className="flex gap-3">
          <button type="button" onClick={() => router.back()} className="px-4 py-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-md transition-colors">
            Cancel
          </button>
          <button type="submit" disabled={submitting} className="px-5 py-2 text-sm font-bold bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:opacity-50">
            {submitting ? 'Adding...' : 'Add to Tracker'}
          </button>
        </div>
      </div>
    </form>
  )
}
