import { AppLayout } from '@/components/layout/app-layout'

export default function DashboardLoading() {
  return (
    <AppLayout>
      <div className="flex flex-1 flex-col items-center justify-center gap-4">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        <p className="text-sm text-muted-foreground">Loading dashboard...</p>
      </div>
    </AppLayout>
  )
}
