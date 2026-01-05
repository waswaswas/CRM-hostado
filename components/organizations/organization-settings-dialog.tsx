'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Users, Crown, Shield, UserCog, Eye, Mail, Settings as SettingsIcon } from 'lucide-react'
import type { Organization, OrganizationMember } from '@/types/database'
import { getOrganizationMembers, getUserRole, updateOrganizationEmailSettings } from '@/app/actions/organizations'

interface OrganizationSettingsDialogProps {
  organization: Organization
  open: boolean
  onOpenChange: (open: boolean) => void
}

const roleIcons = {
  owner: Crown,
  admin: Shield,
  moderator: UserCog,
  viewer: Eye,
}

const roleColors = {
  owner: 'text-yellow-600 dark:text-yellow-400',
  admin: 'text-blue-600 dark:text-blue-400',
  moderator: 'text-purple-600 dark:text-purple-400',
  viewer: 'text-gray-600 dark:text-gray-400',
}

export function OrganizationSettingsDialog({
  organization,
  open,
  onOpenChange,
}: OrganizationSettingsDialogProps) {
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'moderator' | 'viewer' | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  
  // Email settings state
  const [emailSettings, setEmailSettings] = useState({
    from_email: (organization.settings?.email?.from_email as string) || '',
    from_name: (organization.settings?.email?.from_name as string) || '',
    smtp_host: (organization.settings?.email?.smtp_host as string) || '',
    smtp_port: (organization.settings?.email?.smtp_port as string) || '',
    smtp_user: (organization.settings?.email?.smtp_user as string) || '',
    smtp_password: (organization.settings?.email?.smtp_password as string) || '',
    smtp_secure: (organization.settings?.email?.smtp_secure as boolean) ?? true,
  })

  useEffect(() => {
    if (open && organization.id) {
      loadData()
    }
  }, [open, organization.id])

  async function loadData() {
    if (!organization.id) return
    setLoading(true)
    try {
      const [membersData, role] = await Promise.all([
        getOrganizationMembers(organization.id),
        getUserRole(organization.id),
      ])
      setMembers(membersData || [])
      setUserRole(role)
    } catch (error) {
      console.error('Error loading organization data:', error)
      setMembers([])
      setUserRole(null)
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveEmailSettings() {
    setSaving(true)
    try {
      await updateOrganizationEmailSettings(organization.id, emailSettings)
      // Refresh organization data
      window.location.reload()
    } catch (error) {
      console.error('Error saving email settings:', error)
      alert('Failed to save email settings. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  const canManage = userRole === 'owner' || userRole === 'admin'

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <SettingsIcon className="h-5 w-5" />
            {organization.name} Settings
          </DialogTitle>
          <DialogDescription>
            Manage organization members and email settings
          </DialogDescription>
        </DialogHeader>
        <DialogClose onClose={() => onOpenChange(false)} />

        <Tabs defaultValue="members" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="members" className="flex items-center gap-2">
              <Users className="h-4 w-4" />
              Members
            </TabsTrigger>
            <TabsTrigger value="email" className="flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Email Settings
            </TabsTrigger>
          </TabsList>

          <TabsContent value="members" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Users className="h-5 w-5 text-primary" />
                    <CardTitle>Organization Members</CardTitle>
                  </div>
                  {canManage && (
                    <Button size="sm" disabled>
                      Invite Member
                    </Button>
                  )}
                </div>
                <CardDescription>
                  {loading ? 'Loading...' : `${members.length} member${members.length !== 1 ? 's' : ''} in this organization`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading members...</div>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => {
                      const Icon = roleIcons[member.role]
                      const colorClass = roleColors[member.role]
                      return (
                        <div
                          key={member.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div className="flex items-center gap-3">
                            <Icon className={`h-5 w-5 ${colorClass}`} />
                            <div>
                              <div className="font-medium">
                                {member.user_email || 'Unknown User'}
                              </div>
                              <div className="text-sm text-muted-foreground capitalize">
                                {member.role}
                              </div>
                            </div>
                          </div>
                          {canManage && member.role !== 'owner' && (
                            <div className="flex gap-2">
                              <Button variant="outline" size="sm" disabled>
                                Edit
                              </Button>
                              <Button variant="outline" size="sm" disabled>
                                Remove
                              </Button>
                            </div>
                          )}
                        </div>
                      )
                    })}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="email" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Mail className="h-5 w-5 text-primary" />
                  <CardTitle>Email Configuration</CardTitle>
                </div>
                <CardDescription>
                  Configure email settings for this organization
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="from_email">From Email</Label>
                  <Input
                    id="from_email"
                    type="email"
                    placeholder="noreply@example.com"
                    value={emailSettings.from_email}
                    onChange={(e) => setEmailSettings({ ...emailSettings, from_email: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Default email address for outgoing emails
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="from_name">From Name</Label>
                  <Input
                    id="from_name"
                    type="text"
                    placeholder="Your Organization Name"
                    value={emailSettings.from_name}
                    onChange={(e) => setEmailSettings({ ...emailSettings, from_name: e.target.value })}
                  />
                  <p className="text-xs text-muted-foreground">
                    Display name for outgoing emails
                  </p>
                </div>

                <div className="border-t pt-4 space-y-4">
                  <h3 className="font-semibold text-sm">SMTP Settings (Optional)</h3>
                  <p className="text-xs text-muted-foreground">
                    Leave empty to use system default SMTP settings
                  </p>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="smtp_host">SMTP Host</Label>
                      <Input
                        id="smtp_host"
                        type="text"
                        placeholder="smtp.example.com"
                        value={emailSettings.smtp_host}
                        onChange={(e) => setEmailSettings({ ...emailSettings, smtp_host: e.target.value })}
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="smtp_port">SMTP Port</Label>
                      <Input
                        id="smtp_port"
                        type="text"
                        placeholder="587"
                        value={emailSettings.smtp_port}
                        onChange={(e) => setEmailSettings({ ...emailSettings, smtp_port: e.target.value })}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp_user">SMTP Username</Label>
                    <Input
                      id="smtp_user"
                      type="text"
                      placeholder="your-email@example.com"
                      value={emailSettings.smtp_user}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_user: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="smtp_password">SMTP Password</Label>
                    <Input
                      id="smtp_password"
                      type="password"
                      placeholder="••••••••"
                      value={emailSettings.smtp_password}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_password: e.target.value })}
                    />
                    <p className="text-xs text-muted-foreground">
                      Password will be encrypted when saved
                    </p>
                  </div>

                  <div className="flex items-center space-x-2">
                    <input
                      type="checkbox"
                      id="smtp_secure"
                      checked={emailSettings.smtp_secure}
                      onChange={(e) => setEmailSettings({ ...emailSettings, smtp_secure: e.target.checked })}
                      className="rounded border-gray-300"
                    />
                    <Label htmlFor="smtp_secure" className="text-sm font-normal">
                      Use secure connection (TLS/SSL)
                    </Label>
                  </div>
                </div>

                <div className="flex justify-end pt-4 border-t">
                  <Button onClick={handleSaveEmailSettings} disabled={saving || !canManage}>
                    {saving ? 'Saving...' : 'Save Email Settings'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  )
}
