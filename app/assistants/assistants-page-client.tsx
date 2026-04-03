'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { ASSISTANT_BOTS_META, type AssistantBotId } from '@/lib/ai-assistants/bots-meta'
import { sendAssistantChatMessage, type ChatMessageInput } from '@/app/actions/ai-assistants'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, ChevronRight, SendHorizontal, Sparkles, Settings2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useToast } from '@/components/ui/toaster'

type Props = {
  allowedBotIds: AssistantBotId[]
  canManage: boolean
}

export function AssistantsPageClient({ allowedBotIds, canManage }: Props) {
  const { toast } = useToast()
  const [selectedBotId, setSelectedBotId] = useState<AssistantBotId | null>(null)
  const [messages, setMessages] = useState<ChatMessageInput[]>([])
  const [input, setInput] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)

  const visibleBots = ASSISTANT_BOTS_META.filter((b) => allowedBotIds.includes(b.id))

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, sending])

  const openBot = useCallback((id: AssistantBotId) => {
    setSelectedBotId(id)
    setMessages([])
    setInput('')
  }, [])

  const backToPicker = useCallback(() => {
    setSelectedBotId(null)
    setMessages([])
    setInput('')
  }, [])

  const send = useCallback(async () => {
    const text = input.trim()
    if (!text || !selectedBotId || sending) return

    const nextMessages: ChatMessageInput[] = [...messages, { role: 'user', content: text }]
    setMessages(nextMessages)
    setInput('')
    setSending(true)

    try {
      const result = await sendAssistantChatMessage(selectedBotId, nextMessages)
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
  }, [input, selectedBotId, sending, messages, toast])

  const selectedMeta = selectedBotId
    ? ASSISTANT_BOTS_META.find((b) => b.id === selectedBotId)
    : null

  return (
    <div className="mx-auto max-w-5xl space-y-6 pb-24 md:pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Sparkles className="h-4 w-4" aria-hidden />
            Assistants
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">
            {selectedMeta ? selectedMeta.name : 'Choose an assistant'}
          </h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-xl">
            {selectedMeta
              ? 'Conversations stay in this browser session until you leave or refresh.'
              : 'Specialized helpers for email, offers, and projects — grounded in your organization’s knowledge.'}
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
          {selectedBotId && (
            <Button variant="outline" size="sm" className="min-h-[44px] gap-2" onClick={backToPicker}>
              <ArrowLeft className="h-4 w-4" />
              All assistants
            </Button>
          )}
        </div>
      </div>

      {!selectedBotId && (
        <>
          {visibleBots.length === 0 ? (
            <Card className="border-dashed">
              <CardHeader>
                <CardTitle>No assistants assigned</CardTitle>
                <CardDescription>
                  Your organization owner can grant access to assistants and assign which topics you can use.
                </CardDescription>
              </CardHeader>
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visibleBots.map((bot) => (
                <button
                  key={bot.id}
                  type="button"
                  onClick={() => openBot(bot.id)}
                  className={cn(
                    'text-left rounded-xl border-2 p-5 transition-all duration-200 ease-out',
                    'min-h-[120px] flex flex-col gap-3',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
                    'hover:shadow-md hover:-translate-y-0.5 active:translate-y-0 active:shadow-sm',
                    bot.cardAccent
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div
                      className={cn(
                        'flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border bg-background/80',
                        'transition-transform duration-200'
                      )}
                    >
                      <bot.icon className="h-5 w-5 text-foreground" aria-hidden />
                    </div>
                    <ChevronRight className="h-5 w-5 text-muted-foreground shrink-0 mt-1" aria-hidden />
                  </div>
                  <div>
                    <h2 className="font-semibold text-base leading-snug">{bot.name}</h2>
                    <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">
                      {bot.shortDescription}
                    </p>
                  </div>
                  <span className="text-sm font-medium text-primary mt-auto pt-1 inline-flex items-center gap-1">
                    Open chat
                    <ChevronRight className="h-4 w-4" />
                  </span>
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {selectedBotId && selectedMeta && (
        <div className="flex flex-col gap-4 min-h-[50vh]">
          <Card className="flex-1 flex flex-col min-h-[420px] overflow-hidden border-border/80 shadow-sm">
            <CardHeader className="border-b bg-muted/30 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg border bg-background">
                  <selectedMeta.icon className="h-5 w-5" />
                </div>
                <div>
                  <CardTitle className="text-base">{selectedMeta.name}</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    AI can make mistakes — verify important details before sending to clients.
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="flex-1 flex flex-col p-0 min-h-0">
              <div className="flex-1 overflow-y-auto p-4 space-y-4">
                {messages.length === 0 && !sending && (
                  <p className="text-sm text-muted-foreground text-center py-12 px-4">
                    Ask a question or paste a draft. The assistant uses your organization’s configured
                    knowledge for this topic.
                  </p>
                )}
                {messages.map((m, i) => (
                  <div
                    key={i}
                    className={cn(
                      'flex',
                      m.role === 'user' ? 'justify-end' : 'justify-start'
                    )}
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
        </div>
      )}
    </div>
  )
}
