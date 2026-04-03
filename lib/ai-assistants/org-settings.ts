import type { AssistantBotId } from '@/lib/ai-assistants/bots-meta'

/** Stored under organizations.settings.ai_assistants — no new DB tables. */
export type AiAssistantsOrgSettings = {
  /** User IDs (non-owner/admin) allowed to open Assistants. Owner/admin always have access. */
  featureUserIds?: string[]
  /** Per-user allowed bot ids. Owner/admin ignore this (all bots). */
  botAccess?: Record<string, AssistantBotId[]>
  /** Optional extra knowledge per bot, edited by org owner. */
  extraKnowledgeByBot?: Partial<Record<AssistantBotId, string>>
}

/** Serializable subset written to organizations.settings.ai_assistants (excludes API key fields). */
export function pickAiAssistantsPersistedCore(raw: unknown): AiAssistantsOrgSettings {
  return parseAiAssistantsSettings(raw)
}

export function parseAiAssistantsSettings(raw: unknown): AiAssistantsOrgSettings {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const featureUserIds = Array.isArray(o.featureUserIds)
    ? o.featureUserIds.filter((x): x is string => typeof x === 'string')
    : undefined
  const botAccess =
    o.botAccess && typeof o.botAccess === 'object' && !Array.isArray(o.botAccess)
      ? (o.botAccess as Record<string, AssistantBotId[]>)
      : undefined
  const extraKnowledgeByBot =
    o.extraKnowledgeByBot && typeof o.extraKnowledgeByBot === 'object'
      ? (o.extraKnowledgeByBot as Partial<Record<AssistantBotId, string>>)
      : undefined
  return { featureUserIds, botAccess, extraKnowledgeByBot }
}
