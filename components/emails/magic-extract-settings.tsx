'use client'

import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useToast } from '@/components/ui/toaster'
import { ArrowLeft, Plus, Trash2, Edit, Check, X } from 'lucide-react'
import {
  getMagicExtractRules,
  saveMagicExtractRules,
} from '@/app/actions/magic-extract'
import type {
  MagicExtractRule,
  MagicExtractVariableMapping,
  SubjectMatchType,
} from '@/lib/magic-extract-engine'

const TARGET_FIELDS = [
  { value: 'email', label: 'Email (required)' },
  { value: 'name', label: 'Name' },
  { value: 'phone', label: 'Phone' },
  { value: 'message', label: 'Message' },
  { value: 'company', label: 'Company' },
  { value: 'notes_summary', label: 'Notes' },
] as const

function newVariableMapping(): MagicExtractVariableMapping {
  return {
    key: '',
    extraction_type: 'label',
    pattern: '',
    target_field: 'email',
  }
}

function newRule(sortOrder: number): MagicExtractRule {
  return {
    id: crypto.randomUUID(),
    name: '',
    subject_match: '',
    subject_match_type: 'contains',
    variable_mapping: [newVariableMapping()],
    create_interaction: true,
    create_notification: true,
    is_active: true,
    sort_order: sortOrder,
  }
}

export function MagicExtractSettings() {
  const { toast } = useToast()
  const [rules, setRules] = useState<MagicExtractRule[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [form, setForm] = useState<MagicExtractRule>(() => newRule(0))

  const loadRules = useCallback(async () => {
    setLoading(true)
    try {
      const data = await getMagicExtractRules()
      setRules(data)
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to load rules',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }, [toast])

  useEffect(() => {
    loadRules()
  }, [loadRules])

  function startAdd() {
    setEditingId(null)
    setForm(newRule(rules.length))
    setShowForm(true)
  }

  function startEdit(rule: MagicExtractRule) {
    setEditingId(rule.id)
    setForm({ ...rule, variable_mapping: [...(rule.variable_mapping || [])] })
    setShowForm(true)
  }

  function cancelForm() {
    setShowForm(false)
    setEditingId(null)
  }

  function updateForm(partial: Partial<MagicExtractRule>) {
    setForm((prev) => ({ ...prev, ...partial }))
  }

  function updateVariableMapping(index: number, partial: Partial<MagicExtractVariableMapping>) {
    setForm((prev) => {
      const list = [...(prev.variable_mapping || [])]
      list[index] = { ...list[index], ...partial }
      return { ...prev, variable_mapping: list }
    })
  }

  function addVariableMapping() {
    setForm((prev) => ({
      ...prev,
      variable_mapping: [...(prev.variable_mapping || []), newVariableMapping()],
    }))
  }

  function removeVariableMapping(index: number) {
    setForm((prev) => {
      const list = [...(prev.variable_mapping || [])]
      list.splice(index, 1)
      return { ...prev, variable_mapping: list.length ? list : [newVariableMapping()] }
    })
  }

  async function handleSave() {
    if (!form.name.trim()) {
      toast({
        title: 'Validation',
        description: 'Rule name is required',
        variant: 'destructive',
      })
      return
    }
    if (!form.subject_match.trim()) {
      toast({
        title: 'Validation',
        description: 'Subject match is required',
        variant: 'destructive',
      })
      return
    }
    const mapping = form.variable_mapping || []
    const hasEmail = mapping.some(
      (m) => (m.target_field === 'email' || m.target_field === 'clients.email') && m.pattern.trim()
    )
    if (!hasEmail) {
      toast({
        title: 'Validation',
        description: 'At least one variable must map to Email with a pattern',
        variant: 'destructive',
      })
      return
    }

    setSaving(true)
    try {
      let nextRules: MagicExtractRule[]
      if (editingId) {
        nextRules = rules.map((r) => (r.id === editingId ? { ...form } : r))
      } else {
        nextRules = [...rules, { ...form }]
      }
      await saveMagicExtractRules(nextRules)
      toast({
        title: 'Saved',
        description: editingId ? 'Rule updated' : 'Rule added',
      })
      cancelForm()
      loadRules()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to save',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this rule?')) return
    setSaving(true)
    try {
      const nextRules = rules.filter((r) => r.id !== id)
      await saveMagicExtractRules(nextRules)
      toast({ title: 'Deleted', description: 'Rule removed' })
      cancelForm()
      loadRules()
    } catch (err) {
      toast({
        title: 'Error',
        description: err instanceof Error ? err.message : 'Failed to delete',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          <Link href="/emails">
            <Button variant="ghost" size="icon">
              <ArrowLeft className="h-4 w-4" />
            </Button>
          </Link>
          <h1 className="text-2xl md:text-3xl font-bold">Magic extract</h1>
        </div>
        {!showForm && (
          <Button onClick={startAdd} className="min-h-[44px]">
            <Plus className="mr-2 h-4 w-4" />
            Add rule
          </Button>
        )}
      </div>

      <p className="text-muted-foreground">
        When an inbound email subject matches a rule, data is extracted from the body and used to create or update a client. Add at least one variable that maps to Email.
      </p>

      {loading ? (
        <div className="text-muted-foreground">Loading rules…</div>
      ) : showForm ? (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit rule' : 'New rule'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Rule name</label>
              <Input
                className="mt-1"
                value={form.name}
                onChange={(e) => updateForm({ name: e.target.value })}
                placeholder="e.g. Contact form inquiries"
              />
            </div>
            <div>
              <label className="text-sm font-medium">Subject match</label>
              <div className="flex gap-2 mt-1">
                <select
                  className="rounded-md border bg-background px-3 py-2 text-sm min-w-[120px]"
                  value={form.subject_match_type}
                  onChange={(e) => updateForm({ subject_match_type: e.target.value as SubjectMatchType })}
                >
                  <option value="contains">Contains</option>
                  <option value="equals">Equals</option>
                  <option value="regex">Regex</option>
                </select>
                <Input
                  className="flex-1"
                  value={form.subject_match}
                  onChange={(e) => updateForm({ subject_match: e.target.value })}
                  placeholder="e.g. Ново запитване от контактната форма"
                />
              </div>
            </div>
            <div>
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium">Variable mapping</label>
                <Button type="button" variant="outline" size="sm" onClick={addVariableMapping}>
                  <Plus className="h-4 w-4 mr-1" /> Add
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Label: text before a colon (e.g. &quot;Email&quot;). Regex: pattern with one capture group.
              </p>
              <div className="space-y-2 mt-2">
                {(form.variable_mapping || []).map((m, i) => (
                  <div key={i} className="flex flex-wrap items-center gap-2 p-2 border rounded-md">
                    <select
                      className="rounded-md border bg-background px-2 py-1.5 text-sm w-[140px]"
                      value={m.extraction_type}
                      onChange={(e) =>
                        updateVariableMapping(i, {
                          extraction_type: e.target.value as 'label' | 'regex',
                        })
                      }
                    >
                      <option value="label">Label</option>
                      <option value="regex">Regex</option>
                    </select>
                    <Input
                      className="flex-1 min-w-[120px]"
                      value={m.pattern}
                      onChange={(e) => updateVariableMapping(i, { pattern: e.target.value })}
                      placeholder={m.extraction_type === 'label' ? 'Email' : 'Regex with ()'}
                    />
                    <select
                      className="rounded-md border bg-background px-2 py-1.5 text-sm w-[140px]"
                      value={m.target_field}
                      onChange={(e) =>
                        updateVariableMapping(i, { target_field: e.target.value })
                      }
                    >
                      {TARGET_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeVariableMapping(i)}
                      disabled={(form.variable_mapping?.length ?? 0) <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.create_interaction}
                  onChange={(e) => updateForm({ create_interaction: e.target.checked })}
                />
                <span className="text-sm">Create interaction</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.create_notification}
                  onChange={(e) => updateForm({ create_notification: e.target.checked })}
                />
                <span className="text-sm">Create notification</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => updateForm({ is_active: e.target.checked })}
                />
                <span className="text-sm">Active</span>
              </label>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : <><Check className="mr-2 h-4 w-4" /> Save</>}
              </Button>
              <Button variant="outline" onClick={cancelForm}>
                <X className="mr-2 h-4 w-4" /> Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {!loading && rules.length > 0 && (
        <div className="space-y-2">
          <h2 className="text-lg font-semibold">Rules</h2>
          <ul className="space-y-2">
            {rules
              .slice()
              .sort((a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0))
              .map((rule) => (
                <li key={rule.id}>
                  <Card>
                    <CardContent className="p-4 flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <span className="font-medium">{rule.name || 'Unnamed'}</span>
                        {!rule.is_active && (
                          <span className="ml-2 text-xs text-muted-foreground">(inactive)</span>
                        )}
                        <p className="text-sm text-muted-foreground mt-0.5">
                          Subject {rule.subject_match_type}: &quot;{rule.subject_match}&quot;
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {rule.create_interaction && 'Interaction · '}
                          {rule.create_notification && 'Notification'}
                        </p>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => startEdit(rule)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDelete(rule.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                </li>
              ))}
          </ul>
        </div>
      )}

      {!loading && rules.length === 0 && !showForm && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <p>No Magic extract rules yet.</p>
            <Button className="mt-2" onClick={startAdd}>
              <Plus className="mr-2 h-4 w-4" /> Add rule
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  )
}
