'use server'

import { createClient } from '@/lib/supabase/server'
import { startOfWeek, startOfMonth, subDays, isAfter } from 'date-fns'
import { getCurrentOrganizationId } from './organizations'
import type { Client } from '@/types/database'

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

    // Get all user's clients (exclude deleted so counts reflect active clients only)
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('is_deleted', false)

    if (error) {
      if (error.message.includes('Could not find the table') || error.message.includes('relation') || error.message.includes('does not exist')) {
        return {
          newLeadsWeek: 0,
          newLeadsMonth: 0,
          newTagLeads: 0,
          waitingForOffer: 0,
        }
      }
      throw new Error(error.message)
    }

    if (!clients || clients.length === 0) {
      return {
        newLeadsWeek: 0,
        newLeadsMonth: 0,
        newTagLeads: 0,
        waitingForOffer: 0,
      }
    }

    const now = new Date()
    const weekStart = startOfWeek(now, { weekStartsOn: 1 }) // Monday
    const monthStart = startOfMonth(now)
    const fourteenDaysAgo = subDays(now, 14)

    // New leads (week to date) - presales clients created this week
    const newLeadsWeek = clients.filter((client: Client) => {
      if (client.client_type !== 'presales') return false
      const createdDate = new Date(client.created_at)
      return createdDate >= weekStart
    }).length

    // New leads (this month) - presales clients created this month
    const newLeadsMonth = clients.filter((client: Client) => {
      if (client.client_type !== 'presales') return false
      const createdDate = new Date(client.created_at)
      return createdDate >= monthStart
    }).length

    // Leads with "New" tag - presales clients within 14 days
    const newTagLeads = clients.filter((client: Client) => {
      if (client.client_type !== 'presales') return false
      const createdDate = new Date(client.created_at)
      return isAfter(createdDate, fourteenDaysAgo)
    }).length

    // Customers waiting for offer - presales clients with "waits_for_offer" status
    const waitingForOffer = clients.filter((client: Client) => {
      return client.client_type === 'presales' && client.status === 'waits_for_offer'
    }).length

    return {
      newLeadsWeek,
      newLeadsMonth,
      newTagLeads,
      waitingForOffer,
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


