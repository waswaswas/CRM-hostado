import type { LucideIcon } from 'lucide-react'
import { Mail, FileText, FolderKanban } from 'lucide-react'

/** Client-safe catalog (no system prompts — those stay server-only). */
export const ASSISTANT_BOT_IDS = ['email', 'offers', 'projects'] as const
export type AssistantBotId = (typeof ASSISTANT_BOT_IDS)[number]

export type AssistantBotMeta = {
  id: AssistantBotId
  name: string
  shortDescription: string
  /** Tailwind classes for card accent (border + subtle bg). */
  cardAccent: string
  icon: LucideIcon
}

export const ASSISTANT_BOTS_META: AssistantBotMeta[] = [
  {
    id: 'email',
    name: 'Email writing',
    shortDescription: 'Professional client emails, follow-ups, and tone adjustments.',
    cardAccent:
      'border-blue-200/80 bg-blue-50/40 hover:border-blue-300/90 dark:border-blue-900/50 dark:bg-blue-950/20 dark:hover:border-blue-800/60',
    icon: Mail,
  },
  {
    id: 'offers',
    name: 'Offers & proposals',
    shortDescription: 'Structure offers, scope, pricing language, and clarity.',
    cardAccent:
      'border-emerald-200/80 bg-emerald-50/40 hover:border-emerald-300/90 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:hover:border-emerald-800/60',
    icon: FileText,
  },
  {
    id: 'projects',
    name: 'Projects & delivery',
    shortDescription: 'Plans, milestones, risks, and stakeholder communication.',
    cardAccent:
      'border-violet-200/80 bg-violet-50/40 hover:border-violet-300/90 dark:border-violet-900/50 dark:bg-violet-950/20 dark:hover:border-violet-800/60',
    icon: FolderKanban,
  },
]

export function getBotMeta(id: string): AssistantBotMeta | undefined {
  return ASSISTANT_BOTS_META.find((b) => b.id === id)
}
