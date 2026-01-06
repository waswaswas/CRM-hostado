'use client'

import { TransactionWithRelations } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Edit, Trash2, ArrowLeft, Download, FileText } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { deleteTransaction } from '@/app/actions/transactions'
import { useToast } from '@/components/ui/toaster'
import { getSignedUrl } from '@/app/actions/storage'
import { useState } from 'react'

interface TransactionDetailProps {
  transaction: TransactionWithRelations
}

export function TransactionDetail({ transaction }: TransactionDetailProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [downloading, setDownloading] = useState(false)

  const formatAmount = (amount: number, currency: string = 'BGN') => {
    return new Intl.NumberFormat('bg-BG', {
      style: 'currency',
      currency: currency,
      minimumFractionDigits: 2,
    }).format(amount)
  }

  const handleDelete = async () => {
    if (!confirm('Are you sure you want to delete this transaction?')) {
      return
    }

    try {
      await deleteTransaction(transaction.id)
      toast({
        title: 'Success',
        description: 'Transaction deleted successfully',
      })
      router.push('/accounting/transactions')
      router.refresh()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete transaction',
        variant: 'destructive',
      })
    }
  }

  const handleDownloadAttachment = async () => {
    if (!transaction.attachment_url) return

    setDownloading(true)
    try {
      const signedUrl = await getSignedUrl(transaction.attachment_url)
      if (signedUrl) {
        window.open(signedUrl, '_blank')
      } else {
        toast({
          title: 'Error',
          description: 'Failed to generate download link',
          variant: 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to download attachment',
        variant: 'destructive',
      })
    } finally {
      setDownloading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/accounting/transactions">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold capitalize">{transaction.type}</h1>
            <p className="text-muted-foreground">Transaction Details</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/accounting/transactions/${transaction.id}/edit`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          <Button variant="outline" onClick={handleDelete}>
            <Trash2 className="mr-2 h-4 w-4" />
            Delete
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <img src="/hostado-logo.png" alt="hostado" className="h-8 w-auto" />
              <div>
                <div>hostado</div>
                <div className="text-sm font-normal text-muted-foreground">techsupport@hostado.net</div>
              </div>
            </CardTitle>
            <Badge
              className={
                transaction.type === 'income'
                  ? 'bg-green-100 text-green-800'
                  : transaction.type === 'expense'
                  ? 'bg-red-100 text-red-800'
                  : 'bg-blue-100 text-blue-800'
              }
            >
              {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Number</div>
              <div className="font-medium">{transaction.number}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Date</div>
              <div className="font-medium">{format(new Date(transaction.date), 'dd MMM yyyy')}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Account</div>
              <div className="font-medium">{transaction.account?.name || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Category</div>
              <div className="font-medium">{transaction.category || 'N/A'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Payment Method</div>
              <div className="font-medium">{transaction.payment_method}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Reference</div>
              <div className="font-medium">{transaction.reference || 'N/A'}</div>
            </div>
          </div>

          {transaction.description && (
            <div>
              <div className="text-sm text-muted-foreground">Description</div>
              <div className="font-medium">{transaction.description}</div>
            </div>
          )}

          {transaction.attachment_url && (
            <div className="border-t pt-4">
              <div className="text-sm text-muted-foreground mb-2">Invoice Attachment</div>
              <Button
                variant="outline"
                onClick={handleDownloadAttachment}
                disabled={downloading}
                className="flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                {downloading ? 'Generating link...' : 'Download Invoice (PDF)'}
              </Button>
            </div>
          )}

          {transaction.contact && (
            <div className="border-t pt-4">
              <div className="text-sm font-medium mb-2">
                {transaction.type === 'income' ? 'Paid From' : 'Paid To'}
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="text-sm text-muted-foreground">Name</div>
                  <div className="font-medium">{transaction.contact.name}</div>
                </div>
                {transaction.contact.email && (
                  <div>
                    <div className="text-sm text-muted-foreground">Email</div>
                    <div className="font-medium">{transaction.contact.email}</div>
                  </div>
                )}
                {transaction.contact.phone && (
                  <div>
                    <div className="text-sm text-muted-foreground">Phone</div>
                    <div className="font-medium">{transaction.contact.phone}</div>
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="border-t pt-4">
            <div className="flex items-center justify-between">
              <div className="text-lg font-medium">Amount</div>
              <div
                className={`text-2xl font-bold ${
                  transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                }`}
              >
                {transaction.type === 'expense' ? '-' : '+'}
                {formatAmount(transaction.amount, transaction.currency)}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
















