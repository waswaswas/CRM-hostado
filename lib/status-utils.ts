import { ClientStatus, ClientType, PresalesStatus, CustomerStatus } from '@/types/database'
import { subDays, isAfter } from 'date-fns'
import type { StatusConfig } from '@/types/settings'

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

export function getDefaultClientStatusColorHex(status: ClientStatus): string {
  // Values are approximate Tailwind "100" background colors used by getStatusColor()
  switch (status) {
    case 'contacted':
      return '#FEF9C3' // yellow-100
    case 'attention_needed':
      return '#FFEDD5' // orange-100
    case 'follow_up_required':
      return '#FEE2E2' // red-100
    case 'waits_for_offer':
      return '#E0E7FF' // indigo-100
    case 'on_hold':
      return '#F3F4F6' // gray-100
    case 'abandoned':
      return '#FEE2E2' // red-100
    default:
      return '#F3F4F6'
  }
}

const DEFAULT_PRESALES_STATUS_KEYS: ClientStatus[] = [
  'contacted',
  'attention_needed',
  'follow_up_required',
  'waits_for_offer',
  'on_hold',
  'abandoned',
]

export function getStatusesForType(clientType: ClientType | null, customStatuses?: StatusConfig[]): ClientStatus[] {
  if (clientType === 'customer') {
    return ['active', 'inactive']
  }
  // Presales or null (default to presales) - "new" is now a separate tag, not a status
  const defaultStatuses: ClientStatus[] = ['contacted', 'attention_needed', 'follow_up_required', 'waits_for_offer', 'on_hold', 'abandoned']
  const defaultSet = new Set(defaultStatuses)
  
  // Merge custom statuses if provided
  if (customStatuses && customStatuses.length > 0) {
    // Sort custom statuses by order
    const sortedCustom = [...customStatuses].sort((a, b) => a.order - b.order)
    // Add custom status keys to the list (but don't duplicate built-ins)
    const additionalKeys = sortedCustom
      .map((s) => s.key as ClientStatus)
      .filter((key) => !defaultSet.has(key))
    return [...defaultStatuses, ...additionalKeys]
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

function parseHexColorToRgb(color: string): { r: number; g: number; b: number } | null {
  const hex = color.trim()
  if (!hex.startsWith('#')) return null

  const normalized =
    hex.length === 4
      ? `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`
      : hex

  const match = /^#([0-9a-fA-F]{6})$/.exec(normalized)
  if (!match) return null

  const intVal = Number.parseInt(match[1], 16)
  const r = (intVal >> 16) & 255
  const g = (intVal >> 8) & 255
  const b = intVal & 255
  return { r, g, b }
}

function getContrastingTextColor(bgHex: string): string {
  const rgb = parseHexColorToRgb(bgHex)
  if (!rgb) return '#111827'

  // Relative luminance (WCAG)
  const luminance = (0.2126 * rgb.r + 0.7152 * rgb.g + 0.0722 * rgb.b) / 255
  return luminance > 0.6 ? '#111827' : '#FFFFFF'
}

export function getClientStatusBadgeProps(
  status: ClientStatus,
  clientType: ClientType | null,
  customStatuses?: StatusConfig[]
): { className: string; style?: Record<string, string> } {
  const overrideColor = customStatuses?.find((s) => s.key === status)?.color
  if (overrideColor) {
    // If the stored default matches our historical "old default mapping", treat it as unset.
    // This keeps badge colors in sync with the original `getStatusColor()` Tailwind output until
    // the user truly customizes a color in Settings.
    if (DEFAULT_PRESALES_STATUS_KEYS.includes(status)) {
      const oldDefault = getDefaultClientStatusColorHex(status)
      if (overrideColor === oldDefault) {
        return { className: getStatusColor(status, clientType) }
      }
    }

    const bg = overrideColor.trim()
    const fg = getContrastingTextColor(bg)
    return {
      className: '',
      style: {
        backgroundColor: bg,
        color: fg,
      },
    }
  }

  return {
    className: getStatusColor(status, clientType),
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


