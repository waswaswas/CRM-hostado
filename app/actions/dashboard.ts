'use server'

import { getUpcomingReminders, getCompletedReminders } from '@/app/actions/reminders'
import { getRecentClients } from '@/app/actions/clients'
import { getDashboardStats } from '@/app/actions/stats'
import { getSettings } from '@/app/actions/settings'
import { getDashboardPermissionContext } from '@/app/actions/organizations'
import type { Client } from '@/types/database'
import type { StatusConfig } from '@/types/settings'

export type DashboardPageData = {
  reminders: Awaited<ReturnType<typeof getUpcomingReminders>>
  completedReminders: Awaited<ReturnType<typeof getCompletedReminders>>
  clients: Client[]
  stats: Awaited<ReturnType<typeof getDashboardStats>>
  customStatuses: StatusConfig[]
}

const emptyStats = {
  newLeadsWeek: 0,
  newLeadsMonth: 0,
  newTagLeads: 0,
  waitingForOffer: 0,
}

/**
 * Single server action for dashboard card data.
 * Permissions are derived server-side via getDashboardPermissionContext (never trust the client).
 */
export async function getDashboardPageData(): Promise<DashboardPageData> {
  const perm = await getDashboardPermissionContext()
  const hasClients = perm.hasClients === true
  const hasReminders = perm.hasReminders === true

  const [reminders, completedReminders, clients, stats, settings] = await Promise.all([
    hasReminders ? getUpcomingReminders() : Promise.resolve([]),
    hasReminders ? getCompletedReminders(20) : Promise.resolve([]),
    hasClients ? getRecentClients(7) : Promise.resolve([] as Client[]),
    hasClients ? getDashboardStats() : Promise.resolve(emptyStats),
    hasClients
      ? getSettings().catch(() => ({ custom_statuses: [] as StatusConfig[] }))
      : Promise.resolve({ custom_statuses: [] as StatusConfig[] }),
  ])

  return {
    reminders: reminders || [],
    completedReminders: completedReminders || [],
    clients: clients || [],
    stats: stats || emptyStats,
    customStatuses: settings.custom_statuses || [],
  }
}
