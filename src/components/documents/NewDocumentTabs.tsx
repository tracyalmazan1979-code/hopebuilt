'use client'

import { useState } from 'react'
import { FileText, Upload } from 'lucide-react'
import { clsx } from 'clsx'

export function NewDocumentTabs({
  submitForm,
  quickAddForm,
}: {
  submitForm: React.ReactNode
  quickAddForm: React.ReactNode
}) {
  const [mode, setMode] = useState<'submit' | 'quick'>('submit')

  return (
    <div>
      {/* Mode tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setMode('submit')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all',
            mode === 'submit'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-500 border border-gray-200 hover:text-gray-700 hover:border-gray-300'
          )}
        >
          <FileText size={15} />
          Full Submission
        </button>
        <button
          onClick={() => setMode('quick')}
          className={clsx(
            'flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-semibold transition-all',
            mode === 'quick'
              ? 'bg-blue-600 text-white shadow-sm'
              : 'bg-white text-gray-500 border border-gray-200 hover:text-gray-700 hover:border-gray-300'
          )}
        >
          <Upload size={15} />
          Quick Add (Upload Files)
        </button>
      </div>

      {/* Description */}
      <div className="mb-6">
        {mode === 'submit' ? (
          <div>
            <h2 className="font-semibold text-lg text-gray-900">Submit Document for Review</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Complete CAF form with all details, signature, and file attachments
            </p>
          </div>
        ) : (
          <div>
            <h2 className="font-semibold text-lg text-gray-900">Quick Add to Tracker</h2>
            <p className="text-sm text-gray-500 mt-0.5">
              Upload completed CAF, budget sheet, and contract files with minimal info to add to the pipeline
            </p>
          </div>
        )}
      </div>

      {/* Form content */}
      <div className="animate-fade-in">
        {mode === 'submit' ? submitForm : quickAddForm}
      </div>
    </div>
  )
}
