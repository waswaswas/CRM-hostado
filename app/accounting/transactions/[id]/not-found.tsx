import Link from 'next/link'
import { Button } from '@/components/ui/button'

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
      <h2 className="text-2xl font-bold">Transaction Not Found</h2>
      <p className="text-muted-foreground">The transaction you're looking for doesn't exist.</p>
      <Link href="/accounting/transactions">
        <Button>Back to Transactions</Button>
      </Link>
    </div>
  )
}















