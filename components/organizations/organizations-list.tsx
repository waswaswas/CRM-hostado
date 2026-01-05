'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Building2, Plus, Users, Check, Settings } from 'lucide-react'
import type { Organization } from '@/types/database'
import { useOrganization } from '@/lib/organization-context'
import { OrganizationSettingsDialog } from './organization-settings-dialog'

interface OrganizationsListProps {
  initialOrganizations: Organization[]
}

export function OrganizationsList({ initialOrganizations }: OrganizationsListProps) {
  const { currentOrganization, refreshOrganizations } = useOrganization()
  const [organizations] = useState(initialOrganizations)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null)

  if (organizations.length === 0) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center justify-center py-12">
          <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
          <h3 className="text-lg font-semibold mb-2">No organizations yet</h3>
          <p className="text-muted-foreground text-center mb-4">
            Create your first organization to get started
          </p>
          <Link href="/organizations/new">
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              Create Organization
            </Button>
          </Link>
        </CardContent>
      </Card>
    )
  }

  function handleSettingsClick(e: React.MouseEvent, org: Organization) {
    e.preventDefault()
    e.stopPropagation()
    setSelectedOrganization(org)
    setSettingsOpen(true)
  }

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {organizations.map((org) => (
          <div key={org.id} className="relative">
            <Link href={`/organizations/${org.id}`}>
              <Card className={`hover:shadow-md transition-shadow cursor-pointer ${
                currentOrganization?.id === org.id ? 'ring-2 ring-primary' : ''
              }`}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Building2 className="h-5 w-5 text-primary" />
                      <CardTitle className="text-lg">{org.name}</CardTitle>
                    </div>
                    <div className="flex items-center gap-2">
                      {currentOrganization?.id === org.id && (
                        <Check className="h-5 w-5 text-primary" />
                      )}
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={(e) => handleSettingsClick(e, org)}
                        title="Organization Settings"
                      >
                        <Settings className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  <CardDescription className="flex items-center gap-1 mt-2">
                    <Users className="h-4 w-4" />
                    <span>Active organization</span>
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-sm text-muted-foreground">
                    Slug: {org.slug}
                  </div>
                </CardContent>
              </Card>
            </Link>
          </div>
        ))}
        <Link href="/organizations/new">
          <Card className="hover:shadow-md transition-shadow cursor-pointer border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Plus className="h-8 w-8 text-muted-foreground mb-2" />
              <span className="text-sm font-medium">Create Organization</span>
            </CardContent>
          </Card>
        </Link>
      </div>

    {selectedOrganization && (
      <OrganizationSettingsDialog
        organization={selectedOrganization}
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
      />
    )}
    </>
  )
}
