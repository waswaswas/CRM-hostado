'use client'

import { useEffect, useState } from 'react'
import { StickyNote, Plus, Pencil, Trash2, Check, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { useToast } from '@/components/ui/toaster'
import { getQuickNotes, createQuickNote, updateQuickNote, deleteQuickNote } from '@/app/actions/quick-notes'
import type { UserQuickNote } from '@/types/database'
import { format } from 'date-fns'

function QuickNotesPanel() {
  const { toast } = useToast()
  const [notes, setNotes] = useState<UserQuickNote[]>([])
  const [loading, setLoading] = useState(true)
  const [newContent, setNewContent] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editDraft, setEditDraft] = useState('')

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    getQuickNotes()
      .then((rows) => {
        if (!cancelled) setNotes(rows)
      })
      .catch((e) => {
        console.error(e)
        if (!cancelled) {
          toast({
            title: 'Could not load notes',
            description: e instanceof Error ? e.message : 'Unknown error',
            variant: 'destructive',
          })
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once when panel mounts
  }, [])

  async function handleAdd() {
    const trimmed = newContent.trim()
    if (!trimmed) {
      toast({ title: 'Empty note', description: 'Write something before adding.', variant: 'destructive' })
      return
    }
    setSaving(true)
    try {
      const created = await createQuickNote(trimmed)
      setNotes((prev) => [created, ...prev])
      setNewContent('')
      toast({ title: 'Note added' })
    } catch (e) {
      toast({
        title: 'Could not add note',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setSaving(false)
    }
  }

  async function handleSaveEdit(id: string) {
    const trimmed = editDraft.trim()
    if (!trimmed) {
      toast({ title: 'Empty note', description: 'Content cannot be empty.', variant: 'destructive' })
      return
    }
    try {
      const updated = await updateQuickNote(id, trimmed)
      setNotes((prev) => prev.map((n) => (n.id === id ? updated : n)))
      setEditingId(null)
      setEditDraft('')
      toast({ title: 'Note updated' })
    } catch (e) {
      toast({
        title: 'Could not update note',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this note?')) return
    try {
      await deleteQuickNote(id)
      setNotes((prev) => prev.filter((n) => n.id !== id))
      if (editingId === id) {
        setEditingId(null)
        setEditDraft('')
      }
      toast({ title: 'Note deleted' })
    } catch (e) {
      toast({
        title: 'Could not delete note',
        description: e instanceof Error ? e.message : 'Unknown error',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="flex max-h-[min(70vh,28rem)] flex-col">
      <div className="px-3 py-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Quick notes</div>
      <p className="px-3 pb-2 text-[11px] leading-snug text-muted-foreground">
        Only you can see these notes on this account.
      </p>
      <DropdownMenuSeparator />
      <div className="min-h-[120px] flex-1 overflow-y-auto px-2 py-1 [scrollbar-width:thin]">
        {loading ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">Loading…</p>
        ) : notes.length === 0 ? (
          <p className="px-2 py-6 text-center text-sm text-muted-foreground">No quick notes yet.</p>
        ) : (
          <ul className="space-y-2">
            {notes.map((note) => (
              <li key={note.id} className="rounded-lg border border-border/80 bg-muted/30 p-2.5">
                {editingId === note.id ? (
                  <div className="space-y-2">
                    <Textarea
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                      rows={3}
                      className="min-h-[72px] text-sm resize-y"
                    />
                    <div className="flex justify-end gap-1">
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        className="h-8 px-2"
                        onClick={() => {
                          setEditingId(null)
                          setEditDraft('')
                        }}
                      >
                        <X className="h-4 w-4 mr-1" />
                        Cancel
                      </Button>
                      <Button type="button" size="sm" className="h-8 px-2" onClick={() => handleSaveEdit(note.id)}>
                        <Check className="h-4 w-4 mr-1" />
                        Save
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="min-w-0 max-w-full break-words whitespace-pre-wrap text-sm leading-relaxed sm:max-w-none">
                      {note.content}
                    </p>
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
                      <span className="shrink-0 text-[10px] text-muted-foreground">
                        {format(new Date(note.updated_at), 'MMM d, yyyy HH:mm')}
                      </span>
                      <div className="flex shrink-0 gap-0.5 self-end sm:self-auto">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-md"
                          title="Edit"
                          onClick={() => {
                            setEditingId(note.id)
                            setEditDraft(note.content)
                          }}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-md text-destructive hover:text-destructive hover:bg-destructive/10"
                          title="Delete"
                          onClick={() => handleDelete(note.id)}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                  </>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
      <DropdownMenuSeparator />
      <div className="space-y-2 p-3">
        <Textarea
          placeholder="New quick note…"
          value={newContent}
          onChange={(e) => setNewContent(e.target.value)}
          rows={2}
          className="min-h-[56px] text-sm resize-y"
        />
        <Button type="button" className="w-full" size="sm" onClick={handleAdd} disabled={saving}>
          <Plus className="mr-2 h-4 w-4" />
          {saving ? 'Adding…' : 'Add note'}
        </Button>
      </div>
    </div>
  )
}

export function QuickNotesDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/50"
          title="Quick notes"
          aria-label="Quick notes"
        >
          <StickyNote className="h-5 w-5" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent
        align="end"
        mobileInset
        className="w-[min(22rem,calc(100vw-2rem))] max-w-[min(22rem,calc(100vw-2rem))] rounded-xl border-border/80 p-0 shadow-lg"
      >
        <QuickNotesPanel />
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
