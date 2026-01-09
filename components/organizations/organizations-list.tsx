'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { Building2, Plus, Users, Check, Settings, Trash2, AlertTriangle } from 'lucide-react'
import type { Organization } from '@/types/database'
import { useOrganization } from '@/lib/organization-context'
import { OrganizationSettingsDialog } from './organization-settings-dialog'
import { deleteOrganization } from '@/app/actions/organizations'
import { useToast } from '@/components/ui/toaster'
import { getUserRole } from '@/app/actions/organizations'

interface OrganizationsListProps {
  initialOrganizations: Organization[]
}

export function OrganizationsList({ initialOrganizations }: OrganizationsListProps) {
  const { currentOrganization, refreshOrganizations } = useOrganization()
  const router = useRouter()
  const { toast } = useToast()
  const [organizations, setOrganizations] = useState(initialOrganizations)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [selectedOrganization, setSelectedOrganization] = useState<Organization | null>(null)
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false)
  const [orgToDelete, setOrgToDelete] = useState<Organization | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [userRoles, setUserRoles] = useState<Record<string, 'owner' | 'admin' | 'moderator' | 'viewer' | null>>({})

  // If no organizations, redirect to join-organization page
  useEffect(() => {
    if (organizations.length === 0) {
      router.push('/join-organization')
    }
  }, [organizations.length, router])

  // Load user roles for each organization
  // IMPORTANT: This must be called before any early returns to avoid hooks violation
  useEffect(() => {
    async function loadRoles() {
      const roles: Record<string, 'owner' | 'admin' | 'moderator' | 'viewer' | null> = {}
      for (const org of organizations) {
        try {
          const role = await getUserRole(org.id)
          roles[org.id] = role
        } catch (error) {
          console.error(`Error loading role for org ${org.id}:`, error)
          roles[org.id] = null
        }
      }
      setUserRoles(roles)
    }
    if (organizations.length > 0) {
      loadRoles()
    }
  }, [organizations])

  // Early return AFTER all hooks have been called
  if (organizations.length === 0) {
    return null // Will redirect via useEffect above
  }

  function handleSettingsClick(e: React.MouseEvent, org: Organization) {
    e.preventDefault()
    e.stopPropagation()
    setSelectedOrganization(org)
    setSettingsOpen(true)
  }

  function handleDeleteClick(e: React.MouseEvent, org: Organization) {
    e.preventDefault()
    e.stopPropagation()
    setOrgToDelete(org)
    setDeleteDialogOpen(true)
  }

  async function handleConfirmDelete() {
    if (!orgToDelete) return

    setDeleting(true)
    try {
      await deleteOrganization(orgToDelete.id)
      
      // Remove the organization from the list
      const updatedOrgs = organizations.filter(org => org.id !== orgToDelete.id)
      setOrganizations(updatedOrgs)

      toast({
        title: 'Success',
        description: 'Organization deleted successfully',
      })

      // If there are still organizations left, refresh the list
      if (updatedOrgs.length > 0) {
        await refreshOrganizations()
        router.refresh()
      }
      // If no organizations left, the useEffect above will redirect to /join-organization
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete organization',
        variant: 'destructive',
      })
    } finally {
      setDeleting(false)
      setDeleteDialogOpen(false)
      setOrgToDelete(null)
    }
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
                      {userRoles[org.id] === 'owner' && (
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={(e) => handleDeleteClick(e, org)}
                          title="Delete Organization"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
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

    <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <AlertTriangle className="h-5 w-5" />
            Delete Organization
          </DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{orgToDelete?.name}</strong>? This action cannot be undone.
            All data associated with this organization will be permanently deleted.
          </DialogDescription>
        </DialogHeader>
        <div className="flex justify-end gap-2 mt-4">
          <Button
            variant="outline"
            onClick={() => {
              setDeleteDialogOpen(false)
              setOrgToDelete(null)
            }}
            disabled={deleting}
          >
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirmDelete}
            disabled={deleting}
          >
            {deleting ? 'Deleting...' : 'Delete Organization'}
          </Button>
        </div>
        <DialogClose onClose={() => setDeleteDialogOpen(false)} />
      </DialogContent>
    </Dialog>
    </>
  )
}

