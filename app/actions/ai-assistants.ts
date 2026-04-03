'use server'

import { createClient } from '@/lib/supabase/server'
import {
  getCurrentOrganizationId,
  getOrganization,
  updateOrganization,
  getCurrentUserOrgRole,
  type OrgRole,
} from '@/app/actions/organizations'
import { ASSISTANT_BOT_IDS, type AssistantBotId } from '@/lib/ai-assistants/bots-meta'
import { buildSystemPrompt, isValidBotId } from '@/lib/ai-assistants/bots-server'
import {
  parseAiAssistantsSettings,
  pickAiAssistantsPersistedCore,
  type AiAssistantsOrgSettings,
} from '@/lib/ai-assistants/org-settings'
import {
  hasStoredOpenaiKey,
  isKeyStoredEncrypted,
  persistOpenaiKeyFields,
  readOpenaiKeyFromAssistantsRaw,
} from '@/lib/ai-assistants/openai-key-storage'
import { revalidatePath } from 'next/cache'

function mergeAssistantsPayload(
  core: AiAssistantsOrgSettings,
  keyFields: { openai_api_key_encrypted?: string; openai_api_key?: string }
): Record<string, unknown> {
  const out: Record<string, unknown> = {
    featureUserIds: core.featureUserIds,
    botAccess: core.botAccess,
    extraKnowledgeByBot: core.extraKnowledgeByBot,
  }
  if (keyFields.openai_api_key_encrypted) {
    out.openai_api_key_encrypted = keyFields.openai_api_key_encrypted
  }
  if (keyFields.openai_api_key) {
    out.openai_api_key = keyFields.openai_api_key
  }
  return out
}

function readKeyFieldsFromRaw(raw: unknown): {
  openai_api_key_encrypted?: string
  openai_api_key?: string
} {
  if (!raw || typeof raw !== 'object') return {}
  const o = raw as Record<string, unknown>
  const enc =
    typeof o.openai_api_key_encrypted === 'string' && o.openai_api_key_encrypted
      ? o.openai_api_key_encrypted
      : undefined
  const plain =
    typeof o.openai_api_key === 'string' && o.openai_api_key.trim()
      ? o.openai_api_key.trim()
      : undefined
  if (enc) return { openai_api_key_encrypted: enc }
  if (plain) return { openai_api_key: plain }
  return {}
}

export type AssistantsAccessState = {
  canUseFeature: boolean
  canManage: boolean
  allowedBotIds: AssistantBotId[]
  orgId: string | null
}

function resolveAccess(
  userId: string,
  role: OrgRole | null,
  ai: AiAssistantsOrgSettings
): { canUseFeature: boolean; allowedBotIds: AssistantBotId[] } {
  const allBots = [...ASSISTANT_BOT_IDS]

  if (role === 'owner' || role === 'admin') {
    return { canUseFeature: true, allowedBotIds: allBots }
  }

  if (!role) {
    return { canUseFeature: false, allowedBotIds: [] }
  }

  const featureList = ai.featureUserIds
  const canUseFeature = Boolean(featureList?.includes(userId))

  if (!canUseFeature) {
    return { canUseFeature: false, allowedBotIds: [] }
  }

  const assigned = ai.botAccess?.[userId]
  const allowed = (assigned || []).filter((id) => allBots.includes(id))
  return { canUseFeature: true, allowedBotIds: allowed }
}

export async function getAssistantsAccessState(): Promise<AssistantsAccessState> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const orgId = await getCurrentOrganizationId()

  if (!user || !orgId) {
    return {
      canUseFeature: false,
      canManage: false,
      allowedBotIds: [],
      orgId,
    }
  }

  const role = await getCurrentUserOrgRole()
  const org = await getOrganization(orgId)
  const ai = parseAiAssistantsSettings((org?.settings as Record<string, unknown>)?.ai_assistants)

  const { canUseFeature, allowedBotIds } = resolveAccess(user.id, role, ai)
  const canManage = role === 'owner'

  return { canUseFeature, canManage, allowedBotIds, orgId }
}

export type ChatMessageInput = { role: 'user' | 'assistant'; content: string }

export async function sendAssistantChatMessage(
  botId: string,
  messages: ChatMessageInput[]
): Promise<{ reply: string } | { error: string }> {
  const access = await getAssistantsAccessState()
  if (!access.canUseFeature || !access.orgId) {
    return { error: 'You do not have access to Assistants.' }
  }
  if (!isValidBotId(botId)) {
    return { error: 'Invalid assistant.' }
  }
  if (!access.allowedBotIds.includes(botId)) {
    return { error: 'You are not assigned to this assistant.' }
  }

  const org = await getOrganization(access.orgId)
  const rawAi = (org?.settings as Record<string, unknown>)?.ai_assistants
  const orgKey = readOpenaiKeyFromAssistantsRaw(rawAi)
  const apiKey = (orgKey?.trim() || process.env.OPENAI_API_KEY?.trim()) ?? ''
  if (!apiKey) {
    return {
      error:
        'No OpenAI API key is configured. The organization owner can add a key under Assistants → Manage access, or the server can set OPENAI_API_KEY.',
    }
  }

  const ai = parseAiAssistantsSettings(rawAi)
  const extra = ai.extraKnowledgeByBot?.[botId]
  const system = buildSystemPrompt(botId, extra)

  const openaiMessages = [
    { role: 'system' as const, content: system },
    ...messages
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({ role: m.role, content: m.content.slice(0, 32000) })),
  ]

  try {
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
        messages: openaiMessages,
        temperature: 0.6,
        max_tokens: 2048,
      }),
    })

    if (!res.ok) {
      const errText = await res.text()
      console.error('OpenAI error:', res.status, errText)
      return { error: 'The assistant could not complete the request. Try again shortly.' }
    }

    const data = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }
    const reply = data.choices?.[0]?.message?.content?.trim()
    if (!reply) {
      return { error: 'Empty response from the model.' }
    }
    return { reply }
  } catch (e) {
    console.error(e)
    return { error: 'Network error talking to the AI service.' }
  }
}

export async function getAiAssistantsOrgSettingsForManage(): Promise<
  | {
      ok: true
      settings: AiAssistantsOrgSettings
      hasOpenaiApiKey: boolean
      keyStoredEncrypted: boolean
    }
  | { ok: false; error: string }
> {
  const role = await getCurrentUserOrgRole()
  if (role !== 'owner') {
    return { ok: false, error: 'Only the organization owner can manage assistants.' }
  }
  const orgId = await getCurrentOrganizationId()
  if (!orgId) {
    return { ok: false, error: 'No organization selected.' }
  }
  const org = await getOrganization(orgId)
  if (!org) {
    return { ok: false, error: 'Organization not found.' }
  }
  const rawAi = (org.settings as Record<string, unknown>)?.ai_assistants
  const ai = parseAiAssistantsSettings(rawAi)
  return {
    ok: true,
    settings: ai,
    hasOpenaiApiKey: hasStoredOpenaiKey(rawAi),
    keyStoredEncrypted: isKeyStoredEncrypted(rawAi),
  }
}

export async function saveAiAssistantsOrgSettings(
  next: AiAssistantsOrgSettings
): Promise<{ ok: true } | { ok: false; error: string }> {
  const role = await getCurrentUserOrgRole()
  if (role !== 'owner') {
    return { ok: false, error: 'Only the organization owner can update assistant settings.' }
  }
  const orgId = await getCurrentOrganizationId()
  if (!orgId) {
    return { ok: false, error: 'No organization selected.' }
  }
  const org = await getOrganization(orgId)
  if (!org) {
    return { ok: false, error: 'Organization not found.' }
  }

  const prev = (org.settings || {}) as Record<string, unknown>
  const prevAiRaw = prev.ai_assistants
  const keyFields = readKeyFieldsFromRaw(prevAiRaw)

  const sanitized: AiAssistantsOrgSettings = {
    featureUserIds: Array.from(new Set(next.featureUserIds || [])),
    botAccess: {},
    extraKnowledgeByBot: {},
  }

  if (next.botAccess) {
    for (const [uid, bots] of Object.entries(next.botAccess)) {
      if (typeof uid !== 'string' || !uid) continue
      const list = (bots || []).filter((b): b is AssistantBotId =>
        (ASSISTANT_BOT_IDS as readonly string[]).includes(b as string)
      )
      sanitized.botAccess![uid] = list
    }
  }

  if (next.extraKnowledgeByBot) {
    for (const id of ASSISTANT_BOT_IDS) {
      const v = next.extraKnowledgeByBot[id]
      if (typeof v === 'string' && v.trim()) {
        sanitized.extraKnowledgeByBot![id] = v.trim().slice(0, 12000)
      }
    }
  }

  const merged = mergeAssistantsPayload(sanitized, keyFields)

  await updateOrganization(orgId, {
    settings: {
      ...prev,
      ai_assistants: merged,
    },
  })
  revalidatePath('/assistants')
  revalidatePath('/assistants/manage')
  return { ok: true }
}

export async function saveAssistantsOrgOpenaiKey(
  apiKey: string
): Promise<{ ok: true } | { ok: false; error: string }> {
  const role = await getCurrentUserOrgRole()
  if (role !== 'owner') {
    return { ok: false, error: 'Only the organization owner can update the API key.' }
  }
  const orgId = await getCurrentOrganizationId()
  if (!orgId) {
    return { ok: false, error: 'No organization selected.' }
  }
  const trimmed = apiKey.trim()
  if (trimmed.length < 20) {
    return { ok: false, error: 'The API key looks too short.' }
  }

  const org = await getOrganization(orgId)
  if (!org) {
    return { ok: false, error: 'Organization not found.' }
  }

  const prev = (org.settings || {}) as Record<string, unknown>
  const prevAiRaw = prev.ai_assistants
  const core = pickAiAssistantsPersistedCore(prevAiRaw)
  const fields = persistOpenaiKeyFields(trimmed)
  const merged = mergeAssistantsPayload(core, fields)

  await updateOrganization(orgId, {
    settings: {
      ...prev,
      ai_assistants: merged,
    },
  })
  revalidatePath('/assistants')
  revalidatePath('/assistants/manage')
  return { ok: true }
}

export async function clearAssistantsOrgOpenaiKey(): Promise<
  { ok: true } | { ok: false; error: string }
> {
  const role = await getCurrentUserOrgRole()
  if (role !== 'owner') {
    return { ok: false, error: 'Only the organization owner can remove the API key.' }
  }
  const orgId = await getCurrentOrganizationId()
  if (!orgId) {
    return { ok: false, error: 'No organization selected.' }
  }
  const org = await getOrganization(orgId)
  if (!org) {
    return { ok: false, error: 'Organization not found.' }
  }

  const prev = (org.settings || {}) as Record<string, unknown>
  const prevAiRaw = prev.ai_assistants
  const core = pickAiAssistantsPersistedCore(prevAiRaw)
  const merged = mergeAssistantsPayload(core, {})

  await updateOrganization(orgId, {
    settings: {
      ...prev,
      ai_assistants: merged,
    },
  })
  revalidatePath('/assistants')
  revalidatePath('/assistants/manage')
  return { ok: true }
}
