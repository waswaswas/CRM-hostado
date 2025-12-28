'use client'

import { useState, useMemo } from 'react'
import { AccountingCustomerWithRelations } from '@/types/database'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Search, Plus, Upload, Link as LinkIcon } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

interface AccountingCustomersListProps {
  initialCustomers: AccountingCustomerWithRelations[]
}

export function AccountingCustomersList({ initialCustomers }: AccountingCustomersListProps) {
  const [customers] = useState(initialCustomers)
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCustomers = useMemo(() => {
    return customers.filter((customer) => {
      const matchesSearch =
        customer.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.company?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        customer.phone?.toLowerCase().includes(searchQuery.toLowerCase())

      return matchesSearch
    })
  }, [customers, searchQuery])

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ')
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase()
    }
    return name.substring(0, 2).toUpperCase()
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
        <div className="flex-1 min-w-0">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search customers..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
        </div>
        <div className="flex gap-2">
          <Link href="/accounting/customers/import">
            <Button variant="outline" size="sm" className="whitespace-nowrap">
              <Upload className="mr-2 h-4 w-4" />
              <span className="hidden sm:inline">Import</span>
            </Button>
          </Link>
        </div>
      </div>

      <div className="space-y-2">
        {filteredCustomers.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredCustomers.map((customer) => (
              <Link key={customer.id} href={`/accounting/customers/${customer.id}`}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0">
                        <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                          <span className="text-primary font-semibold text-sm">
                            {getInitials(customer.name)}
                          </span>
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold truncate">{customer.name}</h3>
                          {customer.linked_client_id && (
                            <Badge variant="secondary" className="text-xs">
                              <LinkIcon className="h-3 w-3 mr-1" />
                              Linked
                            </Badge>
                          )}
                        </div>
                        {customer.company && (
                          <p className="text-sm text-muted-foreground truncate">{customer.company}</p>
                        )}
                        {customer.email && (
                          <p className="text-xs text-muted-foreground truncate mt-1">{customer.email}</p>
                        )}
                        {customer.phone && (
                          <p className="text-xs text-muted-foreground truncate">{customer.phone}</p>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">
                {searchQuery
                  ? 'No customers found matching your search.'
                  : 'No customers yet.'}
              </p>
              {!searchQuery && (
                <Link href="/accounting/customers/import">
                  <Button className="mt-4">
                    <Upload className="mr-2 h-4 w-4" />
                    Import Customers
                  </Button>
                </Link>
              )}
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}



