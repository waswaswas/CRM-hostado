'use client'

import { useEffect, useMemo, useState, useTransition } from 'react'
import Link from 'next/link'
import type { OrganizationMember } from '@/types/database'
import { ASSISTANT_BOTS_META, ASSISTANT_BOT_IDS, type AssistantBotId } from '@/lib/ai-assistants/bots-meta'
import {
  getAiAssistantsOrgSettingsForManage,
  saveAiAssistantsOrgSettings,
  saveAssistantsOrgOpenaiKey,
  clearAssistantsOrgOpenaiKey,
} from '@/app/actions/ai-assistants'
import type { AiAssistantsOrgSettings } from '@/lib/ai-assistants/org-settings'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { ArrowLeft, Sparkles } from 'lucide-react'
import { useToast } from '@/components/ui/toaster'
import { cn } from '@/lib/utils'

type Props = {
  organizationId: string
  initialMembers: OrganizationMember[]
}

function buildBotAccessMap(
  members: OrganizationMember[],
  settings: AiAssistantsOrgSettings
): Record<string, Set<AssistantBotId>> {
  const ba: Record<string, Set<AssistantBotId>> = {}
  for (const m of members) {
    const list = settings.botAccess?.[m.user_id] || []
    ba[m.user_id] = new Set(list)
  }
  return ba
}

export function AssistantsManageClient({ organizationId, initialMembers }: Props) {
  const { toast } = useToast()
  const [pending, startTransition] = useTransition()
  const [featureUserIds, setFeatureUserIds] = useState<Set<string>>(new Set())
  const [botAccess, setBotAccess] = useState<Record<string, Set<AssistantBotId>>>({})
  const [extraKnowledge, setExtraKnowledge] = useState<Partial<Record<AssistantBotId, string>>>({})
  const [loaded, setLoaded] = useState(false)
  const [hasOpenaiApiKey, setHasOpenaiApiKey] = useState(false)
  const [keyStoredEncrypted, setKeyStoredEncrypted] = useState(false)
  const [openaiKeyInput, setOpenaiKeyInput] = useState('')
  const [keyPending, setKeyPending] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      const res = await getAiAssistantsOrgSettingsForManage()
      if (cancelled) return
      if (!res.ok) {
        toast({ title: 'Error', description: res.error, variant: 'destructive' })
        return
      }
      const s = res.settings
      setFeatureUserIds(new Set(s.featureUserIds || []))
      setBotAccess(buildBotAccessMap(initialMembers, s))
      setExtraKnowledge(s.extraKnowledgeByBot || {})
      setHasOpenaiApiKey(res.hasOpenaiApiKey)
      setKeyStoredEncrypted(res.keyStoredEncrypted)
      setLoaded(true)
    })()
    return () => {
      cancelled = true
    }
  }, [organizationId, initialMembers])

  const manageableMembers = useMemo(
    () => initialMembers.filter((m) => m.role !== 'owner' && m.role !== 'admin'),
    [initialMembers]
  )

  const toggleFeature = (userId: string) => {
    setFeatureUserIds((prev) => {
      const n = new Set(prev)
      if (n.has(userId)) n.delete(userId)
      else n.add(userId)
      return n
    })
  }

  const toggleBot = (userId: string, botId: AssistantBotId) => {
    setBotAccess((prev) => {
      const next = { ...prev }
      const set = new Set(next[userId] || [])
      if (set.has(botId)) set.delete(botId)
      else set.add(botId)
      next[userId] = set
      return next
    })
  }

  const save = () => {
    startTransition(async () => {
      const payload: AiAssistantsOrgSettings = {
        featureUserIds: Array.from(featureUserIds),
        botAccess: {},
        extraKnowledgeByBot: { ...extraKnowledge },
      }
      for (const m of manageableMembers) {
        const set = botAccess[m.user_id]
        payload.botAccess![m.user_id] = set ? Array.from(set) : []
      }
      const res = await saveAiAssistantsOrgSettings(payload)
      if (!res.ok) {
        toast({ title: 'Could not save', description: res.error, variant: 'destructive' })
        return
      }
      toast({ title: 'Saved', description: 'Assistant settings were updated.' })
    })
  }

  const saveOpenaiKey = () => {
    const v = openaiKeyInput.trim()
    if (!v) {
      toast({ title: 'Enter a key', description: 'Paste your OpenAI API secret key.', variant: 'destructive' })
      return
    }
    setKeyPending(true)
    ;(async () => {
      const res = await saveAssistantsOrgOpenaiKey(v)
      setKeyPending(false)
      if (!res.ok) {
        toast({ title: 'Could not save key', description: res.error, variant: 'destructive' })
        return
      }
      setOpenaiKeyInput('')
      setHasOpenaiApiKey(true)
      const meta = await getAiAssistantsOrgSettingsForManage()
      if (meta.ok) setKeyStoredEncrypted(meta.keyStoredEncrypted)
      toast({ title: 'API key saved', description: 'This organization will use your key for Assistants.' })
    })()
  }

  const removeOpenaiKey = () => {
    if (!confirm('Remove the organization API key? Assistants will fall back to the server default key, if any.')) {
      return
    }
    setKeyPending(true)
    ;(async () => {
      const res = await clearAssistantsOrgOpenaiKey()
      setKeyPending(false)
      if (!res.ok) {
        toast({ title: 'Could not remove key', description: res.error, variant: 'destructive' })
        return
      }
      setHasOpenaiApiKey(false)
      setKeyStoredEncrypted(false)
      toast({ title: 'API key removed' })
    })()
  }

  return (
    <div className="mx-auto max-w-4xl space-y-6 pb-24 md:pb-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <Button variant="ghost" size="sm" className="min-h-[44px] -ml-2 gap-2 mb-2" asChild>
            <Link href="/assistants">
              <ArrowLeft className="h-4 w-4" />
              Back to assistants
            </Link>
          </Button>
          <div className="flex items-center gap-2 text-muted-foreground text-sm font-medium">
            <Sparkles className="h-4 w-4" />
            Assistants — administration
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight mt-1">Access & knowledge</h1>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">
            Owners control who may use Assistants (moderators and viewers) and which topic-specific
            assistants each person can open. Admins and the owner always have full access. Knowledge
            below is appended to each assistant&apos;s instructions for your organization only.
          </p>
        </div>
        <Button className="min-h-[44px] shrink-0" onClick={save} disabled={pending || !loaded}>
          {pending ? 'Saving…' : 'Save changes'}
        </Button>
      </div>

      <Card className="transition-shadow duration-200 hover:shadow-md border-primary/15">
        <CardHeader>
          <CardTitle className="text-lg">OpenAI API key</CardTitle>
          <CardDescription>
            Keys are stored on this organization only. They are never shown again after saving.
            {keyStoredEncrypted
              ? ' This deployment encrypts keys at rest (ASSISTANTS_ENCRYPTION_SECRET is set).'
              : ' For encrypted storage, set ASSISTANTS_ENCRYPTION_SECRET on the server; otherwise the key is stored as-is in organization settings.'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {hasOpenaiApiKey && (
            <p className="text-sm text-muted-foreground">
              A key is on file for this organization. Enter a new key below to replace it.
            </p>
          )}
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-2 min-w-0">
              <label htmlFor="org-openai-key" className="text-sm font-medium">
                Secret key
              </label>
              <Input
                id="org-openai-key"
                type="password"
                autoComplete="off"
                placeholder="sk-…"
                value={openaiKeyInput}
                onChange={(e) => setOpenaiKeyInput(e.target.value)}
                className="min-h-[44px] font-mono text-sm"
                disabled={keyPending || !loaded}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                className="min-h-[44px]"
                onClick={saveOpenaiKey}
                disabled={keyPending || !loaded || !openaiKeyInput.trim()}
              >
                {keyPending ? 'Saving…' : 'Save API key'}
              </Button>
              {hasOpenaiApiKey && (
                <Button
                  type="button"
                  variant="outline"
                  className="min-h-[44px]"
                  onClick={removeOpenaiKey}
                  disabled={keyPending || !loaded}
                >
                  Remove key
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      <Card className="transition-shadow duration-200 hover:shadow-md">
        <CardHeader>
          <CardTitle className="text-lg">Member access</CardTitle>
          <CardDescription>
            Enable the Assistants area for each member, then tick which assistants they may use.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="rounded-lg border bg-muted/20 overflow-x-auto">
            <table className="w-full text-sm min-w-[640px]">
              <thead>
                <tr className="border-b bg-muted/40 text-left">
                  <th className="p-3 font-medium w-[200px]">Member</th>
                  <th className="p-3 font-medium w-[100px]">Role</th>
                  <th className="p-3 font-medium">Assistants feature</th>
                  {ASSISTANT_BOT_IDS.map((id) => (
                    <th key={id} className="p-3 font-medium capitalize whitespace-nowrap">
                      {id}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {initialMembers.map((m) => {
                  const isElevated = m.role === 'owner' || m.role === 'admin'
                  const label = m.user_email || m.user_id.slice(0, 8) + '…'
                  return (
                    <tr key={m.user_id} className="border-b last:border-0">
                      <td className="p-3 align-top">
                        <span className="font-medium break-all">{label}</span>
                      </td>
                      <td className="p-3 align-top capitalize text-muted-foreground">{m.role}</td>
                      <td className="p-3 align-top">
                        {isElevated ? (
                          <span className="text-muted-foreground">Always on</span>
                        ) : (
                          <label className="inline-flex items-center gap-2 cursor-pointer min-h-[44px]">
                            <input
                              type="checkbox"
                              className="h-4 w-4 rounded border-input"
                              checked={featureUserIds.has(m.user_id)}
                              onChange={() => toggleFeature(m.user_id)}
                            />
                            <span>Can open Assistants</span>
                          </label>
                        )}
                      </td>
                      {ASSISTANT_BOT_IDS.map((botId) => (
                        <td key={botId} className="p-3 align-top">
                          {isElevated ? (
                            <span className="text-muted-foreground">All</span>
                          ) : (
                            <label
                              className={cn(
                                'inline-flex items-center gap-2 min-h-[44px]',
                                featureUserIds.has(m.user_id) ? 'cursor-pointer' : 'opacity-40'
                              )}
                            >
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-input"
                                disabled={!featureUserIds.has(m.user_id)}
                                checked={Boolean(botAccess[m.user_id]?.has(botId))}
                                onChange={() => toggleBot(m.user_id, botId)}
                              />
                            </label>
                          )}
                        </td>
                      ))}
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      <div className="space-y-4">
        <h2 className="text-lg font-semibold">Organization knowledge</h2>
        <p className="text-sm text-muted-foreground">
          Optional text appended to each assistant&apos;s system context. Keep facts accurate;
          assistants also read built-in topic guides from the product.
        </p>
        <div className="grid gap-4 md:grid-cols-1">
          {ASSISTANT_BOTS_META.map((bot) => (
            <Card
              key={bot.id}
              className={cn(
                'transition-all duration-200 ease-out border-border/80',
                'hover:shadow-md hover:border-border'
              )}
            >
              <CardHeader className="pb-2">
                <div className="flex items-center gap-2">
                  <bot.icon className="h-4 w-4 text-muted-foreground" />
                  <CardTitle className="text-base">{bot.name}</CardTitle>
                </div>
              </CardHeader>
              <CardContent>
                <Textarea
                  value={extraKnowledge[bot.id] || ''}
                  onChange={(e) =>
                    setExtraKnowledge((prev) => ({ ...prev, [bot.id]: e.target.value }))
                  }
                  placeholder="Policies, tone, product facts, links to internal docs (plain text)…"
                  className="min-h-[120px] text-sm"
                  disabled={!loaded}
                />
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  )
}
