'use server'

import { createClient } from '@/lib/supabase/server'
import { startOfWeek, startOfMonth, subDays } from 'date-fns'
import { getCurrentOrganizationId } from './organizations'

export async function getDashboardStats() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return {
        newLeadsWeek: 0,
        newLeadsMonth: 0,
        newTagLeads: 0,
        waitingForOffer: 0,
      }
    }

    const organizationId = await getCurrentOrganizationId()
    if (!organizationId) {
      return {
        newLeadsWeek: 0,
        newLeadsMonth: 0,
        newTagLeads: 0,
        waitingForOffer: 0,
      }
    }

    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }).toISOString()
    const monthStart = startOfMonth(now).toISOString()
    const fourteenDaysAgo = subDays(now, 14).toISOString()

    const base = () =>
      supabase
        .from('clients')
        .select('id', { count: 'exact', head: true })
        .eq('organization_id', organizationId)
        .eq('is_deleted', false)
        .eq('client_type', 'presales')

    const [weekRes, monthRes, newTagRes, waitingRes] = await Promise.all([
      base().gte('created_at', weekStart),
      base().gte('created_at', monthStart),
      base().gte('created_at', fourteenDaysAgo),
      base().eq('status', 'waits_for_offer'),
    ])

    const firstError = weekRes.error || monthRes.error || newTagRes.error || waitingRes.error
    if (firstError) {
      if (
        firstError.message.includes('Could not find the table') ||
        firstError.message.includes('relation') ||
        firstError.message.includes('does not exist')
      ) {
        return {
          newLeadsWeek: 0,
          newLeadsMonth: 0,
          newTagLeads: 0,
          waitingForOffer: 0,
        }
      }
      throw new Error(firstError.message)
    }

    return {
      newLeadsWeek: weekRes.count ?? 0,
      newLeadsMonth: monthRes.count ?? 0,
      newTagLeads: newTagRes.count ?? 0,
      waitingForOffer: waitingRes.count ?? 0,
    }
  } catch (error) {
    console.error('Error fetching dashboard stats:', error)
    return {
      newLeadsWeek: 0,
      newLeadsMonth: 0,
      newTagLeads: 0,
      waitingForOffer: 0,
    }
  }
}
