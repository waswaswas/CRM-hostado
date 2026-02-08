'use client'

import { useState } from 'react'
import { AccountingCustomerWithRelations, TransactionWithRelations, Offer, Client } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Edit, 
  MoreVertical, 
  Plus, 
  FileText, 
  Eye, 
  Copy,
  Star,
  X,
  Link as LinkIcon,
  Unlink,
  XCircle
} from 'lucide-react'
import { LinkCustomerDialog } from './link-customer-dialog'
import { assignCustomerToTransaction } from '@/app/actions/transactions'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import Link from 'next/link'
import { useToast } from '@/components/ui/toaster'
import { useCurrencyDisplay } from '@/lib/currency-display-context'
import { formatForDisplay } from '@/lib/currency-display'

interface AccountingCustomerDetailProps {
  customer: AccountingCustomerWithRelations
  transactions: TransactionWithRelations[]
  offers: Offer[]
  crmClients: Client[]
}

export function AccountingCustomerDetail({ 
  customer, 
  transactions, 
  offers,
  crmClients
}: AccountingCustomerDetailProps) {
  const router = useRouter()
  const { toast } = useToast()
  const { mode } = useCurrencyDisplay()
  const [activeTab, setActiveTab] = useState<'invoices' | 'transactions'>('transactions')
  const [showNewMenu, setShowNewMenu] = useState(false)
  const [showMoreMenu, setShowMoreMenu] = useState(false)
  const [showUnlinkMenu, setShowUnlinkMenu] = useState(false)

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  // Calculate financial summary
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const overdue = offers
    .filter(offer => {
      if (offer.status !== 'sent' && offer.status !== 'accepted' && offer.status !== 'pending_payment') return false
      if (!offer.valid_until) return false
      const validUntil = new Date(offer.valid_until)
      validUntil.setHours(0, 0, 0, 0)
      return validUntil < today
    })
    .reduce((sum, offer) => sum + Number(offer.amount), 0)

  const open = offers
    .filter(offer => {
      if (offer.status === 'paid') return false
      if (offer.status === 'draft' || offer.status === 'rejected' || offer.status === 'expired') return false
      if (offer.valid_until) {
        const validUntil = new Date(offer.valid_until)
        validUntil.setHours(0, 0, 0, 0)
        if (validUntil < today) return false // Already counted in overdue
      }
      return true
    })
    .reduce((sum, offer) => sum + Number(offer.amount), 0)

  const paid = offers
    .filter(offer => offer.status === 'paid')
    .reduce((sum, offer) => sum + Number(offer.amount), 0)

  // Also add income transactions to paid
  const paidFromTransactions = transactions
    .filter(t => t.type === 'income')
    .reduce((sum, t) => sum + Number(t.amount), 0)

  const totalPaid = paid + paidFromTransactions

  const formatAmount = (amount: number, currency: string = 'BGN') => {
    return formatForDisplay(amount, currency, mode)
  }

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'income':
        return 'bg-green-100 text-green-800 border-green-200'
      case 'expense':
        return 'bg-red-100 text-red-800 border-red-200'
      case 'transfer':
        return 'bg-blue-100 text-blue-800 border-blue-200'
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div className="flex items-start gap-4">
          <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
            <span className="text-primary font-semibold text-xl">
              {getInitials(customer.name)}
            </span>
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-3xl font-bold">{customer.name}</h1>
              <Star className="h-5 w-5 text-muted-foreground" />
            </div>
            {customer.company && (
              <p className="text-muted-foreground mt-1">{customer.company}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Button variant="default" onClick={() => setShowNewMenu(!showNewMenu)}>
              <Plus className="mr-2 h-4 w-4" />
              New
              <span className="ml-1">▼</span>
            </Button>
            {showNewMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowNewMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-20 min-w-[150px]">
              <Link 
                href={`/accounting/transactions/new?accounting_customer_id=${customer.id}&type=income`}
                className="block px-4 py-2 text-sm hover:bg-accent rounded-t-md"
                onClick={() => setShowNewMenu(false)}
              >
                <Plus className="inline mr-2 h-4 w-4" />
                Income
              </Link>
              <Link 
                href={`/accounting/transactions/new?accounting_customer_id=${customer.id}&type=expense`}
                className="block px-4 py-2 text-sm hover:bg-accent rounded-b-md"
                onClick={() => setShowNewMenu(false)}
              >
                <Plus className="inline mr-2 h-4 w-4" />
                Expense
              </Link>
                </div>
              </>
            )}
          </div>
          <Link href={`/clients/${customer.id}`}>
            <Button variant="outline">
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
          </Link>
          {customer.linked_client_id ? (
            <div className="relative">
              <Button 
                variant="outline"
                onClick={() => setShowUnlinkMenu(!showUnlinkMenu)}
              >
                <Unlink className="mr-2 h-4 w-4" />
                Unlink CRM
              </Button>
              {showUnlinkMenu && (
                <>
                  <div 
                    className="fixed inset-0 z-10" 
                    onClick={() => setShowUnlinkMenu(false)}
                  />
                  <div className="absolute right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-20 min-w-[200px]">
                    <button 
                      className="block w-full text-left px-4 py-2 text-sm hover:bg-accent rounded-t-md"
                      onClick={async () => {
                        try {
                          const { linkAccountingCustomerToClient } = await import('@/app/actions/accounting-customers')
                          await linkAccountingCustomerToClient(customer.id, null)
                          setShowUnlinkMenu(false)
                          router.refresh()
                        } catch (error) {
                          console.error('Failed to unlink:', error)
                        }
                      }}
                    >
                      Unlink from CRM Client
                    </button>
                    <Link 
                      href={`/clients/${customer.linked_client_id}`}
                      className="block px-4 py-2 text-sm hover:bg-accent rounded-b-md"
                      onClick={() => setShowUnlinkMenu(false)}
                    >
                      View CRM Client
                    </Link>
                  </div>
                </>
              )}
            </div>
          ) : (
            <LinkCustomerDialog 
              customer={customer} 
              crmClients={crmClients}
            />
          )}
          <Button variant="outline">
            <FileText className="mr-2 h-4 w-4" />
            Customer Statement
          </Button>
          <div className="relative">
            <Button variant="ghost" size="icon" onClick={() => setShowMoreMenu(!showMoreMenu)}>
              <MoreVertical className="h-4 w-4" />
            </Button>
            {showMoreMenu && (
              <>
                <div 
                  className="fixed inset-0 z-10" 
                  onClick={() => setShowMoreMenu(false)}
                />
                <div className="absolute right-0 top-full mt-1 bg-background border rounded-md shadow-lg z-20 min-w-[120px]">
                  <button 
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-accent rounded-t-md"
                    onClick={() => setShowMoreMenu(false)}
                  >
                    Export
                  </button>
                  <button 
                    className="block w-full text-left px-4 py-2 text-sm hover:bg-accent rounded-b-md text-red-600"
                    onClick={() => setShowMoreMenu(false)}
                  >
                    Delete
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Left Panel - Customer Info */}
        <div className="lg:col-span-1 space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Address</h3>
                <p className="text-sm">
                  {customer.address || 'Bulgaria'}
                </p>
              </div>
              {customer.linked_client_id && customer.linked_client && (
                <div className="pt-2 border-t">
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Linked to CRM</h3>
                  <Link 
                    href={`/clients/${customer.linked_client_id}`}
                    className="text-sm text-primary hover:underline flex items-center gap-1"
                  >
                    <LinkIcon className="h-3 w-3" />
                    {customer.linked_client.name}
                  </Link>
                </div>
              )}
              {customer.email && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Email</h3>
                  <p className="text-sm">{customer.email}</p>
                </div>
              )}
              {customer.phone && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Phone</h3>
                  <p className="text-sm">{customer.phone}</p>
                </div>
              )}
              <div className="pt-2 border-t">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <X className="h-4 w-4" />
                  <span>Client Portal</span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Right Panel - Financial Summary and Tabs */}
        <div className="lg:col-span-3 space-y-6">
          {/* Financial Summary */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Overdue</div>
                <div className="text-2xl font-bold">{formatAmount(overdue)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Open</div>
                <div className="text-2xl font-bold">{formatAmount(open)}</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-4">
                <div className="text-sm text-muted-foreground mb-1">Paid</div>
                <div className="text-2xl font-bold text-green-600">{formatAmount(totalPaid)}</div>
              </CardContent>
            </Card>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as 'invoices' | 'transactions')}>
            <TabsList>
              <TabsTrigger value="invoices">Invoices</TabsTrigger>
              <TabsTrigger value="transactions">Transactions</TabsTrigger>
            </TabsList>

            <TabsContent value="invoices" className="space-y-2">
              {offers.length > 0 ? (
                <div className="space-y-2">
                  {offers.map((offer) => (
                    <Card key={offer.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 grid grid-cols-5 gap-4 items-center">
                            <div>
                              <div className="text-sm font-medium">
                                {format(new Date(offer.created_at), 'dd MMM yyyy')}
                              </div>
                              <div className="text-xs text-muted-foreground">{offer.title}</div>
                            </div>
                            <div>
                              <Badge variant={offer.status === 'paid' ? 'default' : 'secondary'}>
                                {offer.status}
                              </Badge>
                            </div>
                            <div className="text-sm">{offer.valid_until ? format(new Date(offer.valid_until), 'dd MMM yyyy') : 'N/A'}</div>
                            <div className="text-sm text-muted-foreground">N/A</div>
                            <div className="text-right font-semibold">
                              {formatAmount(Number(offer.amount), offer.currency)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Link href={`/offers/${offer.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <Copy className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-8 w-8">
                              <MoreVertical className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No invoices yet.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="transactions" className="space-y-2">
              {transactions.length > 0 ? (
                <div className="space-y-2">
                  {transactions.map((transaction) => (
                    <Card key={transaction.id} className="hover:shadow-md transition-shadow">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 grid grid-cols-5 gap-4 items-center">
                            <div>
                              <div className="text-sm font-medium">
                                {format(new Date(transaction.date), 'dd MMM yyyy')}
                              </div>
                              <div className="text-xs text-muted-foreground">{transaction.number}</div>
                            </div>
                            <div>
                              <div className="flex items-center gap-2">
                                <div className={`w-2 h-2 rounded-full ${
                                  transaction.type === 'income' ? 'bg-green-500' : 
                                  transaction.type === 'expense' ? 'bg-red-500' : 
                                  'bg-blue-500'
                                }`} />
                                <span className="text-sm font-medium capitalize">{transaction.type}</span>
                              </div>
                              <div className="text-xs text-muted-foreground mt-1">
                                {transaction.category || 'N/A'}
                              </div>
                            </div>
                            <div className="text-sm">{transaction.account?.name || 'N/A'}</div>
                            <div className="text-sm text-muted-foreground">{transaction.reference || 'N/A'}</div>
                            <div className={`text-right font-semibold ${
                              transaction.type === 'income' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              {transaction.type === 'expense' ? '-' : '+'}
                              {formatAmount(transaction.amount, transaction.currency)}
                            </div>
                          </div>
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={async () => {
                                if (confirm('Unlink this transaction from this customer?')) {
                                  try {
                                    await assignCustomerToTransaction(transaction.id, null)
                                    toast({
                                      title: 'Success',
                                      description: 'Transaction unlinked from customer',
                                    })
                                    router.refresh()
                                  } catch (error) {
                                    toast({
                                      title: 'Error',
                                      description: error instanceof Error ? error.message : 'Failed to unlink transaction',
                                      variant: 'destructive',
                                    })
                                  }
                                }
                              }}
                              title="Unlink transaction from customer"
                            >
                              <XCircle className="h-4 w-4 text-muted-foreground hover:text-destructive" />
                            </Button>
                            <Link href={`/accounting/transactions/${transaction.id}`}>
                              <Button variant="ghost" size="icon" className="h-8 w-8">
                                <Eye className="h-4 w-4" />
                              </Button>
                            </Link>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              ) : (
                <Card>
                  <CardContent className="p-8 text-center">
                    <p className="text-muted-foreground">No transactions yet.</p>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  )
}
















