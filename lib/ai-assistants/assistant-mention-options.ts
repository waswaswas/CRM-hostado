export type AssistantMentionClient = { id: string; label: string }

export function buildAssistantClientMentionOptions(
  clients: { id: string; name: string; company: string | null }[]
): AssistantMentionClient[] {
  const counts = new Map<string, number>()
  return clients.map((c) => {
    const name = (c.name || '').trim() || 'Unnamed'
    const company = c.company?.trim()
    let label = company ? `${name} · ${company}` : name
    const n = (counts.get(label) ?? 0) + 1
    counts.set(label, n)
    if (n > 1) {
      label = `${label} (${c.id.slice(0, 8)})`
    }
    return { id: c.id, label }
  })
}
