import { AppLayout } from '@/components/layout/app-layout'
import { Card, CardContent } from '@/components/ui/card'

export default function OfferNotFound() {
  return (
    <AppLayout>
      <div className="flex items-center justify-center min-h-[400px]">
        <Card>
          <CardContent className="p-8 text-center">
            <h2 className="text-2xl font-bold mb-2">Offer Not Found</h2>
            <p className="text-muted-foreground">The offer you're looking for doesn't exist or you don't have access to it.</p>
          </CardContent>
        </Card>
      </div>
    </AppLayout>
  )
}























