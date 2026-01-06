'use client'

import { useState, useEffect } from 'react'
import { Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Select } from '@/components/ui/select'
import { getSettings, updateSettings } from '@/app/actions/settings'
import { useToast } from '@/components/ui/toaster'

// Common timezones - Bulgaria/Sofia is first as default
const TIMEZONES = [
  { value: 'Europe/Sofia', label: 'Sofia, Bulgaria (EET/EEST)' },
  { value: 'UTC', label: 'UTC (Coordinated Universal Time)' },
  { value: 'Europe/London', label: 'London (GMT)' },
  { value: 'Europe/Paris', label: 'Paris (CET)' },
  { value: 'Europe/Berlin', label: 'Berlin (CET)' },
  { value: 'Europe/Moscow', label: 'Moscow (MSK)' },
  { value: 'America/New_York', label: 'Eastern Time (ET)' },
  { value: 'America/Chicago', label: 'Central Time (CT)' },
  { value: 'America/Denver', label: 'Mountain Time (MT)' },
  { value: 'America/Los_Angeles', label: 'Pacific Time (PT)' },
  { value: 'Asia/Dubai', label: 'Dubai (GST)' },
  { value: 'Asia/Tokyo', label: 'Tokyo (JST)' },
  { value: 'Asia/Shanghai', label: 'Shanghai (CST)' },
  { value: 'Australia/Sydney', label: 'Sydney (AEDT)' },
  { value: 'America/Sao_Paulo', label: 'São Paulo (BRT)' },
  { value: 'America/Mexico_City', label: 'Mexico City (CST)' },
  { value: 'Asia/Kolkata', label: 'Mumbai (IST)' },
]

export function TimezoneSelector() {
  const { toast } = useToast()
  const [open, setOpen] = useState(false)
  const [timezone, setTimezone] = useState<string>('Europe/Sofia')
  const [currentTime, setCurrentTime] = useState<string>('')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadTimezone()
  }, [])

  useEffect(() => {
    // Update clock every second
    const updateTime = () => {
      const tz = timezone || 'Europe/Sofia'
      const now = new Date()
      const formatter = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
        hour12: false,
      })
      setCurrentTime(formatter.format(now))
    }

    updateTime()
    const interval = setInterval(updateTime, 1000)

    return () => clearInterval(interval)
  }, [timezone])

  async function loadTimezone() {
    try {
      const settings = await getSettings()
      // Get timezone from settings or default to Sofia
      const stored = (settings as any).timezone
      if (stored) {
        setTimezone(stored)
      } else {
        // Default to Sofia, Bulgaria
        setTimezone('Europe/Sofia')
      }
    } catch (error) {
      // Default to Sofia, Bulgaria
      setTimezone('Europe/Sofia')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    try {
      await updateSettings({ timezone } as any)
      setOpen(false)
      toast({
        title: 'Success',
        description: 'Timezone updated',
      })
      // Store in localStorage for immediate use
      localStorage.setItem('user-timezone', timezone)
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update timezone',
        variant: 'destructive',
      })
    }
  }

  // Get current timezone display name
  const currentTzLabel = TIMEZONES.find(tz => tz.value === timezone)?.label || timezone

  return (
    <>
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen(true)}
        title={`Current timezone: ${currentTzLabel} - ${currentTime}`}
        className="h-9 px-2 gap-1.5"
      >
        <Clock className="h-4 w-4" />
        <span className="text-xs font-mono font-semibold">{currentTime || '--:--'}</span>
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Select Timezone</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Timezone</label>
              <Select
                value={timezone}
                onChange={(e) => setTimezone(e.target.value)}
                className="w-full"
              >
                {TIMEZONES.map((tz) => (
                  <option key={tz.value} value={tz.value}>
                    {tz.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                This will affect how dates and times are displayed throughout the application
              </p>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={loading}>
                Save
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}































