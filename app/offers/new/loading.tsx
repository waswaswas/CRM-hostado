import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default function NewOfferLoading() {
  return (
    <AppLayout>
      <div className="mx-auto max-w-4xl px-4 py-6 space-y-6">
        <h1 className="text-3xl font-bold">New Offer</h1>
        <Card className="overflow-hidden">
          <CardHeader className="border-b bg-muted/30">
            <CardTitle>Create Offer</CardTitle>
          </CardHeader>
          <CardContent className="p-6 space-y-4">
            <div className="space-y-2">
              <p className="text-sm font-medium">Client</p>
              <div className="h-10 w-full rounded-md border bg-muted/50 flex items-center px-3 text-sm text-muted-foreground">
                Loading clients…
              </div>
            </div>
            <p className="text-sm text-muted-foreground">Preparing form…</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}
