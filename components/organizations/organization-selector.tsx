'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Building2, Plus, Check, ChevronDown } from 'lucide-react'
import { useOrganization } from '@/lib/organization-context'
import Link from 'next/link'

export function OrganizationSelector() {
  const { currentOrganization, organizations, setCurrentOrganization, isLoading } = useOrganization()
  const router = useRouter()
  const [pendingInvitations, setPendingInvitations] = useState(0)

  useEffect(() => {
    // Fetch pending invitations count
    fetch('/api/invitations/pending')
      .then(res => res.json())
      .then(data => setPendingInvitations(data.count || 0))
      .catch(() => {})
  }, [])

  const handleSelectOrganization = async (orgId: string) => {
    const org = organizations.find(o => o.id === orgId)
    if (org) {
      await setCurrentOrganization(org)
      router.refresh()
    }
  }

  if (isLoading) {
    return (
      <div className="flex items-center gap-2 px-3 py-2">
        <Building2 className="h-4 w-4 text-muted-foreground animate-pulse" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    )
  }

  // Always show organization selector, even if no organizations
  // If no organizations, show "Create Organization" button
  if (organizations.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/organizations/new">
          <Button variant="outline" size="sm" className="gap-2">
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Create Organization</span>
            <span className="sm:hidden">Create</span>
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="gap-2 min-w-[120px] justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <Building2 className="h-4 w-4 flex-shrink-0" />
              <span className="text-sm font-medium truncate">
                {currentOrganization?.name || organizations[0]?.name || 'Select Org'}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 flex-shrink-0" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-56">
          <DropdownMenuLabel>Organizations</DropdownMenuLabel>
          <DropdownMenuSeparator />
          {organizations.map((org) => (
            <DropdownMenuItem
              key={org.id}
              onClick={() => handleSelectOrganization(org.id)}
              className="flex items-center justify-between cursor-pointer"
            >
              <div className="flex items-center gap-2 min-w-0 flex-1">
                <Building2 className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                <span className="truncate">{org.name}</span>
              </div>
              {currentOrganization?.id === org.id && (
                <Check className="h-4 w-4 text-primary flex-shrink-0" />
              )}
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <Link href="/organizations/new">
            <DropdownMenuItem className="cursor-pointer">
              <Plus className="h-4 w-4 mr-2" />
              Create Organization
            </DropdownMenuItem>
          </Link>
          <Link href="/organizations">
            <DropdownMenuItem className="cursor-pointer">
              <Building2 className="h-4 w-4 mr-2" />
              Manage Organizations
              {pendingInvitations > 0 && (
                <span className="ml-auto bg-primary text-primary-foreground text-xs px-2 py-0.5 rounded-full">
                  {pendingInvitations}
                </span>
              )}
            </DropdownMenuItem>
          </Link>
        </DropdownMenuContent>
      </DropdownMenu>
      <Link href="/organizations/new">
        <Button variant="ghost" size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">New</span>
        </Button>
      </Link>
    </div>
  )
}
