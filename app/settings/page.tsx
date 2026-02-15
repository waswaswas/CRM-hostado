'use client'

import { useState, useEffect } from 'react'
import { AppLayoutClient } from '@/components/layout/app-layout-client'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { getSettings, updateSettings, getStatusChangeHistory } from '@/app/actions/settings'
import { getCurrentUserEmail, getAdminCode, regenerateAdminCode } from '@/app/actions/admin'
import type { StatusConfig } from '@/types/settings'
import { useToast } from '@/components/ui/toaster'
import { GripVertical, Plus, Trash2, Save, Key } from 'lucide-react'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogClose } from '@/components/ui/dialog'

// Simple Label component
const Label = ({ htmlFor, className, children, ...props }: { htmlFor?: string; className?: string; children: React.ReactNode }) => (
  <label htmlFor={htmlFor} className={`text-sm font-medium leading-none ${className || ''}`} {...props}>
    {children}
  </label>
)

export default function SettingsPage() {
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [newTagDays, setNewTagDays] = useState(14)
  const [customStatuses, setCustomStatuses] = useState<StatusConfig[]>([])
  const [statusHistory, setStatusHistory] = useState<any[]>([])
  const [newStatusKey, setNewStatusKey] = useState('')
  const [newStatusLabel, setNewStatusLabel] = useState('')
  const [currentUserEmail, setCurrentUserEmail] = useState<string | null>(null)
  const [keysDialogOpen, setKeysDialogOpen] = useState(false)
  const [adminCode, setAdminCode] = useState<string | null>(null)
  const [adminCodeError, setAdminCodeError] = useState<string | null>(null)
  const [adminCodeLoading, setAdminCodeLoading] = useState(false)
  const [adminCodeRegenerating, setAdminCodeRegenerating] = useState(false)

  useEffect(() => {
    loadSettings()
    loadStatusHistory()
    getCurrentUserEmail().then(setCurrentUserEmail)
  }, [])

  useEffect(() => {
    if (keysDialogOpen && currentUserEmail === 'waswaswas28@gmail.com') {
      setAdminCodeLoading(true)
      getAdminCode()
        .then((res) => {
          if ('code' in res) {
            setAdminCode(res.code)
            setAdminCodeError(null)
          } else {
            setAdminCode(null)
            setAdminCodeError(res.error)
          }
        })
        .finally(() => setAdminCodeLoading(false))
    } else if (!keysDialogOpen) {
      setAdminCode(null)
      setAdminCodeError(null)
    }
  }, [keysDialogOpen, currentUserEmail])

  async function loadSettings() {
    try {
      setLoading(true)
      const settings = await getSettings()
      setNewTagDays(settings.new_tag_days)
      setCustomStatuses(settings.custom_statuses || [])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load settings'
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
      // If it's a table missing error, show a more helpful message
      if (errorMessage.includes('Could not find the table') || errorMessage.includes('does not exist')) {
        console.error('Database tables missing. Please run: supabase/SETUP_SETTINGS_TABLES.sql')
      }
    } finally {
      setLoading(false)
    }
  }

  async function loadStatusHistory() {
    try {
      const history = await getStatusChangeHistory(undefined, 100)
      setStatusHistory(history || [])
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to load status history'
      console.error('Failed to load status history:', errorMessage)
      // Show a helpful message if table doesn't exist
      if (errorMessage.includes('Could not find the table') || errorMessage.includes('does not exist') || errorMessage.includes('relation')) {
        toast({
          title: 'Status History Not Available',
          description: 'Please run the migration: supabase/SETUP_SETTINGS_TABLES.sql in your Supabase SQL Editor',
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Error',
          description: errorMessage,
          variant: 'destructive',
        })
      }
    }
  }

  async function handleSave() {
    try {
      setSaving(true)
      await updateSettings({
        new_tag_days: newTagDays,
        custom_statuses: customStatuses,
      })
      toast({
        title: 'Success',
        description: 'Settings saved successfully',
      })
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save settings',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  function handleAddStatus() {
    if (!newStatusKey || !newStatusLabel) {
      toast({
        title: 'Error',
        description: 'Please enter both key and label',
        variant: 'destructive',
      })
      return
    }

    if (customStatuses.some((s) => s.key === newStatusKey)) {
      toast({
        title: 'Error',
        description: 'Status key already exists',
        variant: 'destructive',
      })
      return
    }

    const newStatus: StatusConfig = {
      key: newStatusKey,
      label: newStatusLabel,
      order: customStatuses.length,
    }

    setCustomStatuses([...customStatuses, newStatus])
    setNewStatusKey('')
    setNewStatusLabel('')
  }

  function handleRemoveStatus(key: string) {
    setCustomStatuses(customStatuses.filter((s) => s.key !== key))
  }

  function handleMoveStatus(index: number, direction: 'up' | 'down') {
    const newStatuses = [...customStatuses]
    if (direction === 'up' && index > 0) {
      ;[newStatuses[index - 1], newStatuses[index]] = [newStatuses[index], newStatuses[index - 1]]
      newStatuses[index - 1].order = index - 1
      newStatuses[index].order = index
    } else if (direction === 'down' && index < newStatuses.length - 1) {
      ;[newStatuses[index], newStatuses[index + 1]] = [newStatuses[index + 1], newStatuses[index]]
      newStatuses[index].order = index
      newStatuses[index + 1].order = index + 1
    }
    setCustomStatuses(newStatuses)
  }

  function handleUpdateStatusLabel(index: number, label: string) {
    const newStatuses = [...customStatuses]
    newStatuses[index].label = label
    setCustomStatuses(newStatuses)
  }

  if (loading) {
    return (
      <AppLayoutClient>
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Loading settings...</p>
        </div>
      </AppLayoutClient>
    )
  }

  return (
    <AppLayoutClient>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">Settings</h1>
          <div className="flex items-center gap-2">
            <Button onClick={handleSave} disabled={saving}>
              <Save className="h-4 w-4 mr-2" />
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
            {currentUserEmail === 'waswaswas28@gmail.com' && (
              <Button variant="outline" onClick={() => setKeysDialogOpen(true)}>
                <Key className="h-4 w-4 mr-2" />
                Keys
              </Button>
            )}
          </div>
        </div>

        {/* Admin Keys dialog – only shown for master admin */}
        <Dialog open={keysDialogOpen} onOpenChange={setKeysDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogClose onClose={() => setKeysDialogOpen(false)} />
            <DialogHeader>
              <DialogTitle>Admin center access code</DialogTitle>
            </DialogHeader>
            {adminCodeLoading ? (
              <p className="text-sm text-muted-foreground">Loading...</p>
            ) : adminCode ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Use this code to sign in at <strong>/admincenter</strong> (no password).
                </p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 rounded border bg-muted px-3 py-2 text-lg font-mono tracking-wider">
                    {adminCode}
                  </code>
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={adminCodeRegenerating}
                    onClick={async () => {
                      setAdminCodeRegenerating(true)
                      const res = await regenerateAdminCode()
                      if ('code' in res) {
                        setAdminCode(res.code)
                        toast({ title: 'Code regenerated', description: 'Use the new code to sign in.' })
                      } else {
                        toast({ title: 'Error', description: res.error, variant: 'destructive' })
                      }
                      setAdminCodeRegenerating(false)
                    }}
                  >
                    {adminCodeRegenerating ? 'Regenerating...' : 'Regenerate'}
                  </Button>
                </div>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                {adminCodeError || 'Unable to load code.'}
              </p>
            )}
          </DialogContent>
        </Dialog>

        {/* New Tag Days Setting */}
        <Card>
          <CardHeader>
            <CardTitle>"New" Tag Duration</CardTitle>
            <CardDescription>
              Set how many days a lead can stay in "New" status before the system automatically removes the tag
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              <Label htmlFor="newTagDays">Days</Label>
              <Input
                id="newTagDays"
                type="number"
                min="1"
                max="365"
                value={newTagDays}
                onChange={(e) => setNewTagDays(parseInt(e.target.value) || 14)}
                className="w-32"
              />
              <p className="text-sm text-muted-foreground">
                Presales leads will show the "New" tag for {newTagDays} days after creation
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Custom Statuses Management */}
        <Card>
          <CardHeader>
            <CardTitle>Lead Statuses</CardTitle>
            <CardDescription>
              Manage available lead statuses. You can rename, reorder, add, or remove statuses.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Default Presales Statuses (read-only info) */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Default Presales Statuses</Label>
              <div className="flex flex-wrap gap-2 mb-4">
                {['contacted', 'attention_needed', 'follow_up_required', 'waits_for_offer', 'on_hold', 'abandoned'].map((status) => (
                  <Badge key={status} variant="outline">
                    {status.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase())}
                  </Badge>
                ))}
              </div>
              <p className="text-sm text-muted-foreground mb-4">
                These are the default system statuses. Custom statuses can be added below.
              </p>
            </div>

            {/* Custom Statuses */}
            <div>
              <Label className="text-sm font-semibold mb-2 block">Custom Statuses</Label>
              {customStatuses.length === 0 ? (
                <p className="text-sm text-muted-foreground mb-4">No custom statuses added yet.</p>
              ) : (
                <div className="space-y-2 mb-4">
                  {customStatuses.map((status, index) => (
                    <div key={status.key} className="flex items-center gap-2 p-3 border rounded-lg">
                      <GripVertical className="h-5 w-5 text-muted-foreground cursor-move" />
                      <Input
                        value={status.label}
                        onChange={(e) => handleUpdateStatusLabel(index, e.target.value)}
                        className="flex-1"
                        placeholder="Status label"
                      />
                      <Badge variant="outline" className="font-mono text-xs">
                        {status.key}
                      </Badge>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveStatus(index, 'up')}
                          disabled={index === 0}
                        >
                          ↑
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleMoveStatus(index, 'down')}
                          disabled={index === customStatuses.length - 1}
                        >
                          ↓
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveStatus(status.key)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add New Status */}
              <div className="flex gap-2">
                <Input
                  placeholder="Status key (e.g., 'custom_status')"
                  value={newStatusKey}
                  onChange={(e) => setNewStatusKey(e.target.value.toLowerCase().replace(/\s+/g, '_'))}
                  className="flex-1"
                />
                <Input
                  placeholder="Status label (e.g., 'Custom Status')"
                  value={newStatusLabel}
                  onChange={(e) => setNewStatusLabel(e.target.value)}
                  className="flex-1"
                />
                <Button onClick={handleAddStatus}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Status Change History */}
        <Card>
          <CardHeader>
            <CardTitle>Status Change History</CardTitle>
            <CardDescription>
              View a log of all status changes, including manual changes and automatic system updates
            </CardDescription>
          </CardHeader>
          <CardContent>
            {statusHistory.length === 0 ? (
              <p className="text-sm text-muted-foreground">No status changes recorded yet.</p>
            ) : (
              <div className="space-y-2">
                {statusHistory.map((entry) => (
                  <div key={entry.id} className="flex items-start justify-between p-3 border rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <Badge variant={entry.change_type === 'automatic' ? 'secondary' : 'default'}>
                          {entry.change_type === 'automatic' ? 'System' : 'Manual'}
                        </Badge>
                        {entry.clients && (
                          <span className="font-medium">{entry.clients.name}</span>
                        )}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        <span className="font-mono">{entry.old_status || 'N/A'}</span>
                        {' → '}
                        <span className="font-mono font-semibold">{entry.new_status}</span>
                      </div>
                      <div className="text-xs text-muted-foreground mt-1">
                        {entry.change_type === 'automatic' ? (
                          <span className="font-medium">Changed by: <span className="text-blue-600 dark:text-blue-400">System</span> (automatic)</span>
                        ) : entry.changed_by_email ? (
                          <span className="font-medium">Changed by: <span className="text-green-600 dark:text-green-400">{entry.changed_by_email}</span></span>
                        ) : entry.changed_by ? (
                          <span className="font-medium">Changed by: User (ID: {entry.changed_by.substring(0, 8)}...)</span>
                        ) : (
                          <span className="font-medium">Changed by: Unknown</span>
                        )}
                      </div>
                      {entry.notes && (
                        <p className="text-xs text-muted-foreground mt-1 italic">{entry.notes}</p>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {format(new Date(entry.created_at), 'MMM d, yyyy HH:mm')}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </AppLayoutClient>
  )
}


