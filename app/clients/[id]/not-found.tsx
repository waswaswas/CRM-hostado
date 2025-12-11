import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { AppLayout } from '@/components/layout/app-layout'

export default function NotFound() {
  return (
    <AppLayout>
      <div className="flex flex-col items-center justify-center p-8">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-muted-foreground">Client not found</p>
        <Link href="/clients" className="mt-4">
          <Button>Back to Clients</Button>
        </Link>
      </div>
    </AppLayout>
  )
}



