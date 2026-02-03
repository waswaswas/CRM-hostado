'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { useToast } from '@/components/ui/toaster'
import { getNotificationPreferences, updateNotificationPreferences, type NotificationPreferences } from '@/app/actions/notifications'
import { Settings } from 'lucide-react'

interface NotificationPreferencesDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function NotificationPreferencesDialog({ open, onOpenChange }: NotificationPreferencesDialogProps) {
  const { toast } = useToast()
  const [prefs, setPrefs] = useState<NotificationPreferences | null>(null)
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (open) {
      getNotificationPreferences()
        .then(setPrefs)
        .catch(() =>
          setPrefs({
            reminders_enabled: true,
            reminders_include_completed: true,
            contacts_enabled: true,
            tasks_enabled: true,
          })
        )
    }
  }, [open])

  async function handleSave() {
    if (!prefs) return
    setLoading(true)
    try {
      await updateNotificationPreferences(prefs)
      toast({ title: 'Saved', description: 'Notification preferences updated' })
      onOpenChange(false)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  if (!prefs) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Notification preferences</DialogTitle>
          <DialogDescription>
            Choose which notifications you want to receive.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-6">
          <div>
            <h4 className="font-medium mb-2">Reminders</h4>
            <div className="space-y-3">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.reminders_enabled}
                  onChange={(e) => setPrefs((p) => p ? { ...p, reminders_enabled: e.target.checked } : p)}
                />
                <span className="text-sm">New reminders</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={prefs.reminders_include_completed}
                  onChange={(e) => setPrefs((p) => p ? { ...p, reminders_include_completed: e.target.checked } : p)}
                  disabled={!prefs.reminders_enabled}
                />
                <span className="text-sm">Reminder completed</span>
              </label>
            </div>
          </div>
          <div>
            <h4 className="font-medium mb-2">Contacts</h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.contacts_enabled}
                onChange={(e) => setPrefs((p) => p ? { ...p, contacts_enabled: e.target.checked } : p)}
              />
              <span className="text-sm">Contact form inquiries</span>
            </label>
          </div>
          <div>
            <h4 className="font-medium mb-2">Tasks</h4>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.tasks_enabled}
                onChange={(e) => setPrefs((p) => p ? { ...p, tasks_enabled: e.target.checked } : p)}
              />
              <span className="text-sm">Task assignments and @mentions</span>
            </label>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
            <Button onClick={handleSave} disabled={loading}>Save</Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

export function NotificationPreferencesButton() {
  const [open, setOpen] = useState(false)
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)} className="gap-2">
        <Settings className="h-4 w-4" />
        Preferences
      </Button>
      <NotificationPreferencesDialog open={open} onOpenChange={setOpen} />
    </>
  )
}
