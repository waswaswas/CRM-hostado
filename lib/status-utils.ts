import { ClientStatus, ClientType, PresalesStatus, CustomerStatus } from '@/types/database'
import { subDays, isAfter } from 'date-fns'

export const STATUS_DESCRIPTIONS: Record<ClientStatus, string> = {
  // Presales statuses (Note: "new" is now a separate tag, not a status)
  contacted: 'First contact made - spoke or exchanged messages',
  attention_needed: 'Needs attention - follow up required',
  follow_up_required: 'Needs follow-up action',
  waits_for_offer: 'Waiting for offer to be sent',
  on_hold: 'Temporarily on hold',
  abandoned: 'No longer pursuing this lead',
  // Customer statuses
  active: 'Active customer',
  inactive: 'Inactive customer',
}

export function getStatusesForType(clientType: ClientType | null, customStatuses?: Array<{ key: string; label: string; order: number }>): ClientStatus[] {
  if (clientType === 'customer') {
    return ['active', 'inactive']
  }
  // Presales or null (default to presales) - "new" is now a separate tag, not a status
  const defaultStatuses: ClientStatus[] = ['contacted', 'attention_needed', 'follow_up_required', 'waits_for_offer', 'on_hold', 'abandoned']
  
  // Merge custom statuses if provided
  if (customStatuses && customStatuses.length > 0) {
    // Sort custom statuses by order
    const sortedCustom = [...customStatuses].sort((a, b) => a.order - b.order)
    // Add custom status keys to the list
    const customKeys = sortedCustom.map(s => s.key as ClientStatus)
    return [...defaultStatuses, ...customKeys]
  }
  
  return defaultStatuses
}

export function isClientNew(createdAt: string, newTagDays: number = 14): boolean {
  const createdDate = new Date(createdAt)
  const daysAgo = subDays(new Date(), newTagDays)
  return isAfter(createdDate, daysAgo)
}

export function getStatusColor(status: ClientStatus, clientType: ClientType | null) {
  if (clientType === 'customer') {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200'
      case 'inactive':
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
      default:
        return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    }
  }
  
  // Presales statuses (Note: "new" is now a separate tag)
  switch (status) {
    case 'contacted':
      return 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200'
    case 'attention_needed':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200'
    case 'follow_up_required':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    case 'waits_for_offer':
      return 'bg-indigo-100 text-indigo-800 dark:bg-indigo-900 dark:text-indigo-200'
    case 'on_hold':
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
    case 'abandoned':
      return 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200'
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-200'
  }
}

export function formatStatus(status: ClientStatus, customStatuses?: Array<{ key: string; label: string }>): string {
  // Check if it's a custom status
  if (customStatuses) {
    const customStatus = customStatuses.find(s => s.key === status)
    if (customStatus) {
      return customStatus.label
    }
  }
  
  // Special handling for follow_up_required - rename to "Follow up needed"
  if (status === 'follow_up_required') {
    return 'Follow up needed'
  }
  
  // Default formatting for built-in statuses
  return status
    .split('_')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ')
}

// Note: "New" is now a tag that automatically disappears after 14 days
// This function is no longer needed but kept for backward compatibility
export function shouldAutoSwitchToAttentionNeeded(
  status: ClientStatus,
  createdAt: string,
  clientType: ClientType | null
): boolean {
  // Always return false - "new" is now a tag, not a status
  return false
}


