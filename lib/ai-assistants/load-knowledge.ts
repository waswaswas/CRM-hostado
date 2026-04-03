import fs from 'fs'
import path from 'path'

export function loadBotKnowledgeFile(botId: string): string {
  const safeId = path.basename(botId)
  const file = path.join(process.cwd(), 'lib/ai-assistants/knowledge', `${safeId}.md`)
  try {
    return fs.readFileSync(file, 'utf8').trim()
  } catch {
    return ''
  }
}
