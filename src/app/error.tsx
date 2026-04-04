'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-app flex items-center justify-center p-6">
      <div className="card p-8 max-w-md w-full text-center">
        <div className="text-4xl mb-4">Something went wrong</div>
        <p className="text-sm text-muted mb-6">
          {error.message || 'An unexpected error occurred. Please try again.'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 rounded-md bg-amber-500 text-black font-bold text-sm hover:bg-amber-400 transition-colors"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
