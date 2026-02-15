'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  adminListOrganizations,
  adminListUsers,
  adminLogout,
  adminImpersonate,
  adminUpdateUserEmail,
  adminUpdateUserPassword,
  adminBanUser,
  adminUnbanUser,
  adminUnassignFromOrg,
} from '@/app/actions/admin'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { useToast } from '@/components/ui/toaster'
import {
  ShieldCheck,
  LogOut,
  Building2,
  Users,
  UserCog,
  Mail,
  Key,
  Ban,
  UserMinus,
  Loader2,
} from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'

type OrgRow = { id: string; name: string; invite_code: string | null; invite_code_expires_at: string | null }
type UserRow = {
  id: string
  email: string | null
  created_at: string
  banned: boolean
  banned_reason: string | null
  orgs: { organization_id: string; organization_name: string; role: string }[]
}

export function AdminDashboardClient() {
  const { toast } = useToast()
  const [orgs, setOrgs] = useState<OrgRow[]>([])
  const [users, setUsers] = useState<UserRow[]>([])
  const [loading, setLoading] = useState(true)
  const [actionUserId, setActionUserId] = useState<string | null>(null)
  const [actionType, setActionType] = useState<'email' | 'password' | 'ban' | null>(null)
  const [actionValue, setActionValue] = useState('')
  const [actionLoading, setActionLoading] = useState(false)
  const [unassignTarget, setUnassignTarget] = useState<{ userId: string; orgId: string; orgName: string } | null>(null)
  const [unassignLoading, setUnassignLoading] = useState(false)

  async function load() {
    setLoading(true)
    try {
      const [orgList, userList] = await Promise.all([
        adminListOrganizations(),
        adminListUsers(),
      ])
      setOrgs(orgList)
      setUsers(userList)
    } catch (e) {
      toast({
        title: 'Error',
        description: e instanceof Error ? e.message : 'Failed to load data',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    load()
  }, [])

  async function handleImpersonate(userId: string) {
    try {
      const res = await adminImpersonate(userId)
      if ('url' in res) {
        window.open(res.url, '_blank')
        toast({ title: 'Magic link opened', description: 'Sign in in the new tab to impersonate.' })
      } else {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' })
    }
  }

  function openDialog(userId: string, type: 'email' | 'password' | 'ban') {
    setActionUserId(userId)
    setActionType(type)
    setActionValue('')
  }

  async function submitAction() {
    if (!actionUserId || !actionType) return
    setActionLoading(true)
    try {
      let res: { success?: true; error?: string }
      if (actionType === 'email') {
        res = await adminUpdateUserEmail(actionUserId, actionValue.trim())
      } else if (actionType === 'password') {
        res = await adminUpdateUserPassword(actionUserId, actionValue)
      } else if (actionType === 'ban') {
        res = await adminBanUser(actionUserId, actionValue.trim())
      } else {
        setActionLoading(false)
        return
      }
      if (res && 'success' in res) {
        toast({ title: 'Done', description: 'Update applied.' })
        setActionType(null)
        setActionUserId(null)
        load()
      } else {
        toast({ title: 'Error', description: (res as { error: string }).error, variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' })
    } finally {
      setActionLoading(false)
    }
  }

  async function handleUnban(userId: string) {
    try {
      const res = await adminUnbanUser(userId)
      if ('success' in res) {
        toast({ title: 'User unbanned' })
        load()
      } else {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' })
    }
  }

  async function confirmUnassign() {
    if (!unassignTarget) return
    setUnassignLoading(true)
    try {
      const res = await adminUnassignFromOrg(unassignTarget.userId, unassignTarget.orgId)
      if ('success' in res) {
        toast({ title: 'User unassigned', description: `Removed from ${unassignTarget.orgName}` })
        setUnassignTarget(null)
        load()
      } else {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
      }
    } catch (e) {
      toast({ title: 'Error', description: e instanceof Error ? e.message : 'Failed', variant: 'destructive' })
    } finally {
      setUnassignLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-8 w-8 text-muted-foreground" />
          <div>
            <h1 className="text-2xl font-bold">Admin Center</h1>
            <p className="text-sm text-muted-foreground">Organizations, users, and actions</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" asChild>
            <Link href="/dashboard">Back to app</Link>
          </Button>
          <form action={adminLogout}>
            <Button type="submit" variant="ghost" size="sm">
              <LogOut className="h-4 w-4 mr-2" />
              Log out
            </Button>
          </form>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Building2 className="h-5 w-5" />
            Organizations
          </CardTitle>
          <CardDescription>All organizations and their invite codes</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Name</th>
                  <th className="p-3 text-left font-medium">Invite code</th>
                  <th className="p-3 text-left font-medium">Expires</th>
                </tr>
              </thead>
              <tbody>
                {orgs.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-muted-foreground">
                      No organizations
                    </td>
                  </tr>
                ) : (
                  orgs.map((row) => (
                    <tr key={row.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">{row.name}</td>
                      <td className="p-3 font-mono">{row.invite_code ?? '—'}</td>
                      <td className="p-3 text-muted-foreground">
                        {row.invite_code_expires_at
                          ? format(new Date(row.invite_code_expires_at), 'PPp')
                          : '—'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Users
          </CardTitle>
          <CardDescription>All users and org memberships. Impersonate, change email/password, ban, unassign.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto rounded-md border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b bg-muted/50">
                  <th className="p-3 text-left font-medium">Email</th>
                  <th className="p-3 text-left font-medium">Created</th>
                  <th className="p-3 text-left font-medium">Status</th>
                  <th className="p-3 text-left font-medium">Organizations</th>
                  <th className="p-3 text-right font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-4 text-center text-muted-foreground">
                      No users
                    </td>
                  </tr>
                ) : (
                  users.map((u) => (
                    <tr key={u.id} className="border-b last:border-0">
                      <td className="p-3 font-medium">{u.email ?? u.id.slice(0, 8)}</td>
                      <td className="p-3 text-muted-foreground">
                        {format(new Date(u.created_at), 'PP')}
                      </td>
                      <td className="p-3">
                        {u.banned ? (
                          <Badge variant="destructive" title={u.banned_reason ?? undefined}>
                            Banned
                          </Badge>
                        ) : (
                          <Badge variant="secondary">Active</Badge>
                        )}
                      </td>
                      <td className="p-3">
                        <div className="flex flex-wrap gap-1">
                          {u.orgs.map((o) => (
                            <span
                              key={o.organization_id}
                              className="inline-flex items-center gap-1 rounded bg-muted px-2 py-0.5 text-xs"
                            >
                              {o.organization_name} ({o.role})
                              <Button
                                type="button"
                                variant="ghost"
                                size="icon"
                                className="h-5 w-5"
                                title="Unassign from this org"
                                onClick={() =>
                                  setUnassignTarget({
                                    userId: u.id,
                                    orgId: o.organization_id,
                                    orgName: o.organization_name,
                                  })
                                }
                              >
                                <UserMinus className="h-3 w-3" />
                              </Button>
                            </span>
                          ))}
                          {u.orgs.length === 0 && (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </div>
                      </td>
                      <td className="p-3 text-right">
                        <div className="flex flex-wrap justify-end gap-1">
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Impersonate (magic link)"
                            onClick={() => handleImpersonate(u.id)}
                          >
                            <UserCog className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Change email"
                            onClick={() => openDialog(u.id, 'email')}
                          >
                            <Mail className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            title="Change password"
                            onClick={() => openDialog(u.id, 'password')}
                          >
                            <Key className="h-4 w-4" />
                          </Button>
                          {u.banned ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Unban"
                              onClick={() => handleUnban(u.id)}
                            >
                              <Ban className="h-4 w-4 text-green-600" />
                            </Button>
                          ) : (
                            <Button
                              variant="ghost"
                              size="sm"
                              title="Ban user"
                              onClick={() => openDialog(u.id, 'ban')}
                            >
                              <Ban className="h-4 w-4" />
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Action dialog: email / password / ban */}
      <Dialog open={!!actionType} onOpenChange={(open) => !open && setActionType(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogClose onClose={() => setActionType(null)} />
          <DialogHeader>
            <DialogTitle>
              {actionType === 'email' && 'Change email'}
              {actionType === 'password' && 'Change password'}
              {actionType === 'ban' && 'Ban user'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {actionType === 'email' && (
              <Input
                type="email"
                placeholder="New email"
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                disabled={actionLoading}
              />
            )}
            {actionType === 'password' && (
              <Input
                type="password"
                placeholder="New password"
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                disabled={actionLoading}
              />
            )}
            {actionType === 'ban' && (
              <Input
                type="text"
                placeholder="Reason for ban"
                value={actionValue}
                onChange={(e) => setActionValue(e.target.value)}
                disabled={actionLoading}
              />
            )}
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setActionType(null)} disabled={actionLoading}>
                Cancel
              </Button>
              <Button onClick={submitAction} disabled={actionLoading || (actionType === 'ban' && !actionValue.trim())}>
                {actionLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  'Apply'
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Unassign confirm */}
      <Dialog open={!!unassignTarget} onOpenChange={(open) => !open && setUnassignTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogClose onClose={() => setUnassignTarget(null)} />
          <DialogHeader>
            <DialogTitle>Unassign from organization</DialogTitle>
            <DialogDescription>
              {unassignTarget &&
                `Remove this user from "${unassignTarget.orgName}"? They will lose access to that organization.`}
            </DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setUnassignTarget(null)} disabled={unassignLoading}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmUnassign} disabled={unassignLoading}>
              {unassignLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Unassign'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  )
}
