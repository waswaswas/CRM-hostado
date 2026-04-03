'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { ASSISTANT_BOTS_META, type AssistantBotId } from '@/lib/ai-assistants/bots-meta'
import { sendAssistantChatMessage, type ChatMessageInput } from '@/app/actions/ai-assistants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card'
import { Select } from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { SendHorizontal, Sparkles, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toaster'

type Props = {
  allowedBotIds: AssistantBotId[]
  canManage: boolean
}

type BotSelection = 'auto' | AssistantBotId

export function AssistantsPageClient({ allowedBotIds, canManage }: Props) {
  const { toast } = useToast()
  const visibleBots = useMemo(
    () => ASSISTANT_BOTS_META.filter((b) => allowedBotIds.includes(b.id)),
    [allowedBotIds]
  )

  const [selection, setSelection] = useState<BotSelection>('auto')
  const [messages, setMessages] = useState<ChatMessageInput[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const prevEffectiveRef = useRef<AssistantBotId | null>(null)

  const effectiveBotId = useMemo((): AssistantBotId | null => {
    if (visibleBots.length === 0) return null
    if (selection === 'auto') return visibleBots[0].id
    return visibleBots.some((b) => b.id === selection) ? selection : visibleBots[0].id
  }, [selection, visibleBots])

  const selectedMeta = effectiveBotId
    ? ASSISTANT_BOTS_META.find((b) => b.id === effectiveBotId)
    : null

  const selectorLabel =
    selection === 'auto'
      ? 'Auto'
      : selectedMeta?.name ?? 'Auto'

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  useEffect(() => {
    const prev = prevEffectiveRef.current
    if (prev !== null && effectiveBotId !== null && prev !== effectiveBotId) {
      setMessages([])
      setInput('')
    }
    prevEffectiveRef.current = effectiveBotId
  }, [effectiveBotId])

  const onBotSelectChange = useCallback((value: string) => {
    setSelection(value === 'auto' ? 'auto' : (value as AssistantBotId))
  }, [])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || !effectiveBotId || sending) return

    const nextMessages: ChatMessageInput[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)

    try {
      const result = await sendAssistantChatMessage(effectiveBotId, nextMessages)
      if ('error' in result) {
        toast({
          title: 'Assistant',
          description: result.error,
          variant: 'destructive',
        })
        setMessages(messages)
        return
      }
      setMessages([...nextMessages, { role: 'assistant', content: result.reply }])
    } catch {
      toast({
        title: 'Error',
        description: 'Something went wrong.',
        variant: 'destructive',
      })
      setMessages(messages)
    } finally {
      setSending(false)
    }
  }, [input, effectiveBotId, sending, messages, toast])

  return (
    <div className="mx-auto max-w-5xl space-y-5 pb-24 md:pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Sparkles className="h-4 w-4" aria-hidden />
            Assistants
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">Assistants</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            Conversations stay in this browser session until you leave or refresh. Choose who you
            want to help you from the menu above the chat.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {canManage && (
            <Button variant="outline" size="sm" className="min-h-[44px] gap-2" asChild>
              <Link href="/assistants/manage">
                <Settings2 className="h-4 w-4" />
                Manage access
              </Link>
            </Button>
          )}
        </div>
      </div>

      {visibleBots.length === 0 ? (
        <Card className="border-dashed">
          <CardHeader>
            <CardDescription className="text-base text-foreground font-medium">
              No assistants assigned
            </CardDescription>
            <p className="text-sm text-muted-foreground">
              Your organization owner can grant access to assistants and assign which topics you can
              use.
            </p>
          </CardHeader>
        </Card>
      ) : (
        <Card className="flex flex-col min-h-[min(70vh,640px)] overflow-hidden border-border/80 shadow-sm">
          <CardHeader className="border-b bg-muted/20 py-3 px-4 sm:px-5 space-y-0 gap-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex flex-wrap items-center gap-3">
                <label htmlFor="assistant-bot-select" className="sr-only">
                  Assistant
                </label>
                <Select
                  id="assistant-bot-select"
                  value={selection}
                  onChange={(e) => onBotSelectChange(e.target.value)}
                  aria-label="Choose assistant"
                  className={cn(
                    'h-10 min-h-[44px] w-[min(100%,220px)] sm:w-auto sm:min-w-[140px] max-w-full',
                    'rounded-lg border border-zinc-700/90 bg-zinc-900 text-zinc-100',
                    'shadow-sm pr-10 text-sm font-normal',
                    'focus:ring-2 focus:ring-zinc-500 focus:ring-offset-2 focus:ring-offset-background',
                    'dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-100',
                    '[&>option]:bg-zinc-900 [&>option]:text-zinc-100 dark:[&>option]:bg-zinc-950'
                  )}
                >
                  <option value="auto">Auto</option>
                  {visibleBots.map((bot) => (
                    <option key={bot.id} value={bot.id}>
                      {bot.name}
                    </option>
                  ))}
                </Select>
                <span className="text-xs text-muted-foreground hidden sm:inline">
                  {selection === 'auto'
                    ? `Using ${selectedMeta?.name ?? 'first available'}`
                    : null}
                </span>
              </div>
              <p className="text-xs text-muted-foreground sm:text-right sm:max-w-[280px]">
                AI can make mistakes — verify important details before sending to clients.
              </p>
            </div>
          </CardHeader>
          <CardContent className="flex-1 flex flex-col p-0 min-h-0">
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {messages.length === 0 && !sending && (
                <p className="text-sm text-muted-foreground text-center py-10 px-4">
                  Ask a question or paste a draft. Assistant:{' '}
                  <span className="font-medium text-foreground">{selectorLabel}</span>
                  {selection === 'auto' && selectedMeta ? (
                    <span className="text-muted-foreground"> ({selectedMeta.name})</span>
                  ) : null}
                  .
                </p>
              )}
              {messages.map((m, i) => (
                <div
                  key={i}
                  className={cn('flex', m.role === 'user' ? 'justify-end' : 'justify-start')}
                >
                  <div
                    className={cn(
                      'max-w-[min(100%,42rem)] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap',
                      m.role === 'user'
                        ? 'bg-primary text-primary-foreground rounded-br-md'
                        : 'bg-muted border border-border/60 rounded-bl-md'
                    )}
                  >
                    {m.content}
                  </div>
                </div>
              ))}
              {sending && (
                <div className="flex justify-start">
                  <div className="bg-muted border border-border/60 rounded-2xl rounded-bl-md px-4 py-3 text-sm text-muted-foreground">
                    Thinking…
                  </div>
                </div>
              )}
              <div ref={bottomRef} />
            </div>
            <div className="border-t p-3 sm:p-4 bg-background space-y-3">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Write your message…"
                className="min-h-[88px] resize-none text-base sm:text-sm"
                disabled={sending}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault()
                    send()
                  }
                }}
              />
              <div className="flex justify-end">
                <Button
                  type="button"
                  className="min-h-[44px] gap-2"
                  onClick={send}
                  disabled={sending || !input.trim()}
                >
                  <SendHorizontal className="h-4 w-4" />
                  Send
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
