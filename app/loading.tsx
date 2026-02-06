export default function Loading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-muted/50">
      <div className="flex flex-col items-center gap-4">
        <img
          src="/hostado-logo.png"
          alt="Hostado"
          className="h-14 w-auto object-contain sm:h-16"
        />
        <div className="flex items-center gap-2 text-muted-foreground">
          <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          <span className="text-sm">Loading...</span>
        </div>
      </div>
    </div>
  )
}
