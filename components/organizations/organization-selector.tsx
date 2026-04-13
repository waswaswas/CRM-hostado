'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Building2, Plus, Check, ChevronDown, Users } from 'lucide-react'
import { useOrganization } from '@/lib/organization-context'
import { JoinOrganizationDialog } from '@/components/organizations/join-organization-dialog'
import Link from 'next/link'

export function OrganizationSelector() {
  const { currentOrganization, organizations, switchOrganization, isLoading } = useOrganization()
  const [pendingInvitations, setPendingInvitations] = useState(0)
  const [joinOrgOpen, setJoinOrgOpen] = useState(false)

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
      await switchOrganization(org)
    }
  }

  if (isLoading) {
    return (
      <div className="flex h-8 max-w-[min(8.5rem,calc(100vw-8.25rem))] items-center gap-1 truncate rounded-md border border-border/80 bg-background px-1.5 sm:max-w-none sm:gap-1.5 sm:px-2">
        <Building2 className="h-3 w-3 shrink-0 text-muted-foreground animate-pulse sm:h-3.5 sm:w-3.5" />
        <span className="truncate text-[11px] text-muted-foreground sm:text-xs">Loading...</span>
      </div>
    )
  }

  // Always show organization selector, even if no organizations
  // If no organizations, show "Create Organization" button
  if (organizations.length === 0) {
    return (
      <div className="flex items-center gap-2">
        <Link href="/organizations/new">
          <Button variant="outline" size="sm" className="no-touch-target h-8 gap-1.5 px-2 py-0 text-xs">
            <Plus className="h-3.5 w-3.5" />
            <span className="hidden sm:inline text-xs">Create Organization</span>
            <span className="sm:hidden text-xs">Create</span>
          </Button>
        </Link>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 sm:gap-2">
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="no-touch-target inline-flex h-8 w-full min-w-0 max-w-[min(8.5rem,calc(100vw-8.25rem))] items-center justify-between gap-1 rounded-md px-1.5 py-0 text-[11px] font-medium leading-tight sm:min-w-[100px] sm:max-w-none sm:gap-1.5 sm:px-2 sm:text-xs"
          >
            <div className="flex min-w-0 items-center gap-1 sm:gap-1.5">
              <Building2 className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
              <span className="truncate">
                {currentOrganization?.name || organizations[0]?.name || 'Select Org'}
              </span>
            </div>
            <ChevronDown className="h-3 w-3 shrink-0 sm:h-3.5 sm:w-3.5" />
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
          <DropdownMenuItem onClick={() => setJoinOrgOpen(true)} className="cursor-pointer">
            <Users className="h-4 w-4 mr-2" />
            Join Organization
          </DropdownMenuItem>
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
      <Link href="/organizations/new" className="hidden sm:inline-flex">
        <Button variant="ghost" size="sm" className="no-touch-target gap-1.5 px-2 py-0 text-xs h-7 sm:h-8">
          <Plus className="h-3.5 w-3.5" />
          <span className="hidden sm:inline text-xs">New</span>
        </Button>
      </Link>
      <JoinOrganizationDialog open={joinOrgOpen} onOpenChange={setJoinOrgOpen} />
    </div>
  )
}

