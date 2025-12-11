// Types for settings functionality

export type StatusConfig = {
  key: string
  label: string
  order: number
  color?: string
}

export type Settings = {
  new_tag_days: number
  custom_statuses: StatusConfig[]
  timezone?: string
}


