'use client'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html>
      <body>
        <div style={{ padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
          <h1>Application Error</h1>
          <p>Something went wrong. Please try refreshing the page.</p>
          <button onClick={() => reset()}>Try again</button>
          <button onClick={() => (window.location.href = '/dashboard')}>
            Go to Dashboard
          </button>
          {process.env.NODE_ENV === 'development' && (
            <pre style={{ marginTop: '20px', padding: '10px', background: '#f5f5f5' }}>
              {error.message}
            </pre>
          )}
        </div>
      </body>
    </html>
  )
}


