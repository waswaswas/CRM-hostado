'use client'

import { useState } from 'react'
import { Account } from '@/types/database'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog'
import { AccountForm } from './account-form'
import { Plus, Search, Lock } from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface AccountsListProps {
  accounts: Account[]
}

export function AccountsList({ accounts: initialAccounts }: AccountsListProps) {
  const [accounts, setAccounts] = useState(initialAccounts)
  const [searchQuery, setSearchQuery] = useState('')
  const [showNewAccountDialog, setShowNewAccountDialog] = useState(false)

  const filteredAccounts = accounts.filter(
    (account) =>
      account.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.account_number?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      account.bank_name?.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const formatBalance = (balance: number) => {
    return new Intl.NumberFormat('bg-BG', {
      style: 'currency',
      currency: 'BGN',
      minimumFractionDigits: 2,
    }).format(balance)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search or filter results..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <Dialog open={showNewAccountDialog} onOpenChange={setShowNewAccountDialog}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              New Account
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>New Account</DialogTitle>
            </DialogHeader>
            <AccountForm
              onSuccess={(account) => {
                setAccounts([...accounts, account])
                setShowNewAccountDialog(false)
              }}
            />
          </DialogContent>
        </Dialog>
      </div>

      <div className="space-y-2">
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredAccounts.map((account) => (
            <Card key={account.id} className="hover:shadow-md transition-shadow">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg flex items-center gap-2">
                      {account.name}
                      {account.is_locked && <Lock className="h-4 w-4 text-muted-foreground" />}
                    </CardTitle>
                    {account.account_number && (
                      <p className="text-sm text-muted-foreground mt-1">
                        Account Number: {account.account_number}
                      </p>
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {account.bank_name && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Bank Name: </span>
                      <span>{account.bank_name}</span>
                    </div>
                  )}
                  {account.bank_phone && (
                    <div className="text-sm">
                      <span className="text-muted-foreground">Bank Phone: </span>
                      <span>{account.bank_phone}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t">
                    <div className="text-sm text-muted-foreground">Current Balance</div>
                    <div
                      className={`text-2xl font-semibold ${
                        account.current_balance < 0 ? 'text-red-600' : 'text-green-600'
                      }`}
                    >
                      {formatBalance(account.current_balance)}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {filteredAccounts.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                {searchQuery ? 'No accounts found matching your search.' : 'No accounts yet.'}
              </p>
              {!searchQuery && (
                <Button
                  className="mt-4"
                  onClick={() => setShowNewAccountDialog(true)}
                >
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Account
                </Button>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}











