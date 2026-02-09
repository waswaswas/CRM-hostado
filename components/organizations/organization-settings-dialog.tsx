'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select } from '@/components/ui/select'
import { Users, Crown, Shield, UserCog, Eye, Mail, Settings as SettingsIcon, Copy, Check } from 'lucide-react'
import type { Organization, OrganizationMember } from '@/types/database'
import { getOrganizationMembers, getUserRole, updateOrganizationEmailSettings, generateInvitationCode, updateMemberPermissions, getMemberPermissions, updateMemberRole } from '@/app/actions/organizations'
import { useToast } from '@/components/ui/toaster'

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
  const { toast } = useToast()
  const [members, setMembers] = useState<OrganizationMember[]>([])
  const [userRole, setUserRole] = useState<'owner' | 'admin' | 'moderator' | 'viewer' | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [invitationCode, setInvitationCode] = useState<string | null>(null)
  const [codeExpiresAt, setCodeExpiresAt] = useState<string | null>(null)
  const [generatingCode, setGeneratingCode] = useState(false)
  const [codeCopied, setCodeCopied] = useState(false)
  const [expandedMember, setExpandedMember] = useState<string | null>(null)
  const [memberPermissions, setMemberPermissions] = useState<Record<string, Record<string, boolean>>>({})
  const [savingPermissions, setSavingPermissions] = useState<string | null>(null)
  const [savingRole, setSavingRole] = useState<string | null>(null)
  
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

  async function loadMemberPermissions(memberId: string, userId: string) {
    if (!organization.id || !canManagePermissions) return
    try {
      const perms = await getMemberPermissions(organization.id, userId)
      setMemberPermissions(prev => ({
        ...prev,
        [memberId]: perms,
      }))
    } catch (error) {
      console.error('Error loading member permissions:', error)
    }
  }

  async function handleTogglePermission(memberId: string, userId: string, feature: string, currentValue: boolean) {
    if (!organization.id || !canManagePermissions || savingPermissions === memberId) return // Prevent concurrent updates
    
    // Store the previous value for rollback on error
    const previousPerms = { ...(memberPermissions[memberId] || {}) }
    const newValue = !currentValue
    
    // Optimistically update UI
    const updatedPerms = {
      ...previousPerms,
      [feature]: newValue,
    }
    setMemberPermissions(prev => ({
      ...prev,
      [memberId]: updatedPerms,
    }))
    
    setSavingPermissions(memberId)
    try {
      await updateMemberPermissions(organization.id, userId, updatedPerms)
      
      // Refresh permissions from server to ensure consistency
      await loadMemberPermissions(memberId, userId)
      
      // Show success feedback (subtle, not intrusive)
      toast({
        title: 'Permissions updated',
        description: `${feature} permission ${newValue ? 'enabled' : 'disabled'}`,
      })
    } catch (error) {
      console.error('Error updating permissions:', error)
      
      // Rollback to previous state on error
      setMemberPermissions(prev => ({
        ...prev,
        [memberId]: previousPerms,
      }))
      
      // Show user-friendly error message using toast
      const errorMessage = error instanceof Error 
        ? error.message 
        : 'Failed to update permissions. Please try again.'
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setSavingPermissions(null)
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

  async function handleGenerateInvitationCode() {
    setGeneratingCode(true)
    try {
      const result = await generateInvitationCode(organization.id)
      setInvitationCode(result.code)
      setCodeExpiresAt(result.expires_at)
    } catch (error) {
      console.error('Error generating invitation code:', error)
      alert('Failed to generate invitation code. Please try again.')
    } finally {
      setGeneratingCode(false)
    }
  }

  async function handleCopyCode() {
    if (invitationCode) {
      await navigator.clipboard.writeText(invitationCode)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    }
  }

  function getTimeRemaining(expiresAt: string): string {
    const now = new Date()
    const expires = new Date(expiresAt)
    const diff = expires.getTime() - now.getTime()
    const minutes = Math.floor(diff / 60000)
    if (minutes <= 0) return 'Expired'
    return `${minutes} minutes`
  }

  const canManage = userRole === 'owner' || userRole === 'admin'
  const canManagePermissions = userRole === 'owner'
  const canManageRoles = userRole === 'owner'

  const defaultViewerPermissions: Record<string, boolean> = {
    dashboard: false,
    clients: false,
    offers: false,
    emails: false,
    accounting: false,
    reminders: false,
    settings: false,
    users: false,
    todo: false,
  }

  async function handleRoleChange(memberId: string, userId: string, role: 'admin' | 'viewer') {
    if (!organization.id || !canManageRoles || savingRole === memberId) return
    setSavingRole(memberId)
    try {
      await updateMemberRole(organization.id, userId, role)
      setMembers((prev) =>
        prev.map((member) =>
          member.id === memberId ? { ...member, role } : member
        )
      )

      if (role === 'viewer') {
        await updateMemberPermissions(organization.id, userId, defaultViewerPermissions)
        await loadMemberPermissions(memberId, userId)
      } else {
        setExpandedMember(null)
      }
    } catch (error) {
      console.error('Error updating role:', error)
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update role',
        variant: 'destructive',
      })
    } finally {
      setSavingRole(null)
    }
  }

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
                    <Button 
                      size="sm" 
                      onClick={handleGenerateInvitationCode}
                      disabled={generatingCode}
                    >
                      {generatingCode ? 'Generating...' : 'Invite Member'}
                    </Button>
                  )}
                </div>
                <CardDescription>
                  {loading ? 'Loading...' : `${members.length} member${members.length !== 1 ? 's' : ''} in this organization`}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {invitationCode && (
                  <div className="mb-4 p-4 bg-muted rounded-lg border-2 border-primary">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="text-sm font-medium mb-1">Invitation Code</p>
                        <p className="text-xs text-muted-foreground">
                          Expires in {codeExpiresAt ? getTimeRemaining(codeExpiresAt) : '60 minutes'}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleCopyCode}
                        className="flex items-center gap-2"
                      >
                        {codeCopied ? (
                          <>
                            <Check className="h-4 w-4" />
                            Copied!
                          </>
                        ) : (
                          <>
                            <Copy className="h-4 w-4" />
                            Copy
                          </>
                        )}
                      </Button>
                    </div>
                    <div className="bg-background p-3 rounded border font-mono text-lg font-bold text-center tracking-wider">
                      {invitationCode}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2 text-center">
                      Share this code with the person you want to invite. They can use it to join this organization.
                    </p>
                  </div>
                )}
                {loading ? (
                  <div className="text-center py-8 text-muted-foreground">Loading members...</div>
                ) : (
                  <div className="space-y-2">
                    {members.map((member) => {
                      const Icon = roleIcons[member.role]
                      const colorClass = roleColors[member.role]
                      const isExpanded = expandedMember === member.id
                      const perms = memberPermissions[member.id] || {}
                      const isOwnerOrAdmin = member.role === 'owner' || member.role === 'admin'

                      return (
                        <div
                          key={member.id}
                          className="border rounded-lg overflow-hidden"
                        >
                          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2 p-4 sm:p-3">
                            <div className="flex items-center gap-3 flex-1 min-w-0">
                              <Icon className={`h-5 w-5 sm:h-5 sm:w-5 ${colorClass} shrink-0`} />
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-base sm:text-sm break-all">
                                  {member.user_email || 'Unknown User'}
                                </div>
                                <div className="text-sm sm:text-xs text-muted-foreground capitalize mt-1">
                                  {member.role}
                                </div>
                              </div>
                            </div>
                            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2 sm:gap-2 shrink-0">
                              {canManageRoles && member.role !== 'owner' && (
                                <Select
                                  value={member.role}
                                  onChange={(event) =>
                                    handleRoleChange(
                                      member.id,
                                      member.user_id,
                                      event.target.value as 'admin' | 'viewer'
                                    )
                                  }
                                  className="w-full sm:w-32 min-h-[44px] sm:min-h-0"
                                  disabled={savingRole === member.id}
                                >
                                  <option value="viewer">Viewer</option>
                                  <option value="admin">Admin</option>
                                </Select>
                              )}
                              {canManagePermissions && !isOwnerOrAdmin && (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => {
                                    if (!isExpanded) {
                                      loadMemberPermissions(member.id, member.user_id)
                                    }
                                    setExpandedMember(isExpanded ? null : member.id)
                                  }}
                                  className="min-h-[44px] sm:min-h-0 w-full sm:w-auto"
                                >
                                  {isExpanded ? 'Hide' : 'Manage Permissions'}
                                </Button>
                              )}
                              {isOwnerOrAdmin && (
                                <span className="text-xs text-muted-foreground px-2 py-2 sm:py-0 text-center sm:text-left">
                                  Full access
                                </span>
                              )}
                            </div>
                          </div>
                          {isExpanded && !isOwnerOrAdmin && (
                            <div className="border-t p-4 sm:p-4 bg-muted/50">
                              <p className="text-sm sm:text-sm font-medium mb-3">Feature Permissions</p>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-3">
                                {[
                                  { key: 'dashboard', label: 'Dashboard' },
                                  { key: 'clients', label: 'Clients' },
                                  { key: 'offers', label: 'Offers' },
                                  { key: 'emails', label: 'Emails' },
                                  { key: 'accounting', label: 'Accounting' },
                                  { key: 'reminders', label: 'Reminders' },
                                  { key: 'settings', label: 'Settings' },
                                  { key: 'todo', label: 'To-Do List' },
                                ].map(({ key, label }) => (
                                  <label
                                    key={key}
                                    className="flex items-center gap-3 sm:gap-2 cursor-pointer min-h-[44px] sm:min-h-0 py-1 sm:py-0"
                                  >
                                    <input
                                      type="checkbox"
                                      checked={perms[key] || false}
                                      onChange={() => handleTogglePermission(
                                        member.id,
                                        member.user_id,
                                        key,
                                        perms[key] || false
                                      )}
                                      disabled={savingPermissions === member.id}
                                      className="h-5 w-5 sm:h-4 sm:w-4 rounded border-gray-300 accent-blue-800 dark:accent-blue-500 shrink-0"
                                    />
                                    <span className="text-sm sm:text-sm">{label}</span>
                                  </label>
                                ))}
                              </div>
                              {savingPermissions === member.id && (
                                <p className="text-xs text-muted-foreground mt-2">Saving...</p>
                              )}
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

