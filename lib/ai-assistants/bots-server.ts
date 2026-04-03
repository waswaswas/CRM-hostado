import type { AssistantBotId } from '@/lib/ai-assistants/bots-meta'
import { ASSISTANT_BOT_IDS } from '@/lib/ai-assistants/bots-meta'
import { loadBotKnowledgeFile } from '@/lib/ai-assistants/load-knowledge'

const BASE_SYSTEM: Record<AssistantBotId, string> = {
  email: `You are an expert business writing assistant for a CRM user. Help draft and refine emails. 
Be concise. Output ready-to-send text when asked unless the user wants an outline.
Never invent facts about the recipient, company, or deal.`,
  offers: `You are an expert presales and proposals assistant. Help structure offers, scopes, and client-facing language.
Be professional and clear. Never invent pricing, legal terms, or binding commitments.`,
  projects: `You are an expert project and delivery assistant. Help with plans, updates, risks, and communication.
Be practical. Never invent dates, team names, or commitments not provided by the user.`,
}

export function isValidBotId(id: string): id is AssistantBotId {
  return (ASSISTANT_BOT_IDS as readonly string[]).includes(id)
}

export function buildSystemPrompt(
  botId: AssistantBotId,
  orgExtraKnowledge?: string
): string {
  const base = BASE_SYSTEM[botId]
  const fileKnowledge = loadBotKnowledgeFile(botId)
  const parts = [base]
  if (fileKnowledge) {
    parts.push('--- Organization knowledge base (reference) ---', fileKnowledge)
  }
  if (orgExtraKnowledge?.trim()) {
    parts.push('--- Additional instructions from organization owner ---', orgExtraKnowledge.trim())
  }
  return parts.join('\n\n')
}
