import Link from 'next/link'

export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="flex flex-col items-center gap-6">
        <img
          src="/hostado-logo.png"
          alt="Hostado"
          className="h-14 w-auto object-contain sm:h-16"
        />
        <div className="flex flex-col items-center gap-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            <span className="text-sm">Loading...</span>
          </div>
          <Link
            href="/login"
            className="text-sm text-primary hover:underline"
          >
            Having trouble? Go to Login
          </Link>
        </div>
      </div>
    </div>
  )
}
