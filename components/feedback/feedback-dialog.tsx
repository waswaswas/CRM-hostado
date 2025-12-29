'use client'

import { useState, useEffect } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogClose } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { createFeedback, updateFeedback, deleteFeedback, getFeedback, toggleFeedbackCompleted, type Feedback } from '@/app/actions/feedback'
import { useToast } from '@/components/ui/toaster'
import { Edit, Trash2, Plus, Check } from 'lucide-react'
import { format } from 'date-fns'

interface FeedbackDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

export function FeedbackDialog({ open, onOpenChange }: FeedbackDialogProps) {
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [feedbackList, setFeedbackList] = useState<Feedback[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    note: '',
    priority: '',
  })

  useEffect(() => {
    if (open) {
      loadFeedback()
    }
  }, [open])

  async function loadFeedback() {
    try {
      const data = await getFeedback()
      setFeedbackList(data)
    } catch (error) {
      console.error('Failed to load feedback:', error)
    }
  }

  function startEdit(feedback: Feedback) {
    setEditingId(feedback.id)
    setFormData({
      note: feedback.note,
      priority: feedback.priority || '',
    })
  }

  function cancelEdit() {
    setEditingId(null)
    setFormData({
      note: '',
      priority: '',
    })
  }

  async function handleSave() {
    if (!formData.note.trim()) {
      toast({
        title: 'Error',
        description: 'Note is required',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      if (editingId) {
        await updateFeedback(editingId, {
          note: formData.note,
          priority: formData.priority || null,
        })
        toast({
          title: 'Success',
          description: 'Feedback updated successfully',
        })
      } else {
        await createFeedback({
          note: formData.note,
          priority: formData.priority || undefined,
        })
        toast({
          title: 'Success',
          description: 'Feedback created successfully',
        })
      }
      cancelEdit()
      loadFeedback()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save feedback',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this feedback?')) {
      return
    }

    setLoading(true)
    try {
      await deleteFeedback(id)
      toast({
        title: 'Success',
        description: 'Feedback deleted successfully',
      })
      loadFeedback()
      if (editingId === id) {
        cancelEdit()
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete feedback',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleToggleCompleted(id: string, completed: boolean) {
    try {
      await toggleFeedbackCompleted(id, completed)
      loadFeedback()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to update feedback',
        variant: 'destructive',
      })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Feedback & Improvements</DialogTitle>
          <DialogDescription>
            Add notes for improvements and track feedback
          </DialogDescription>
        </DialogHeader>
        <DialogClose onClose={() => onOpenChange(false)} />

        <div className="space-y-6">
          {/* Form */}
          <div className="space-y-4 border-b pb-4">
            <h3 className="font-semibold">
              {editingId ? 'Edit Feedback' : 'Add New Feedback'}
            </h3>
            <div>
              <label className="text-sm font-medium mb-1 block">
                Note <span className="text-destructive">*</span>
              </label>
              <Textarea
                value={formData.note}
                onChange={(e) => setFormData({ ...formData, note: e.target.value })}
                placeholder="Enter your feedback note..."
                rows={3}
                required
                disabled={loading}
              />
            </div>

            <div>
              <label className="text-sm font-medium mb-1 block">
                Priority (optional)
              </label>
              <Select
                value={formData.priority}
                onChange={(e) => setFormData({ ...formData, priority: e.target.value })}
                disabled={loading}
              >
                <option value="">None</option>
                <option value="low">Low</option>
                <option value="medium">Medium</option>
                <option value="high">High</option>
              </Select>
            </div>

            <div className="flex justify-end gap-2">
              {editingId && (
                <Button
                  variant="outline"
                  onClick={cancelEdit}
                  disabled={loading}
                >
                  Cancel
                </Button>
              )}
              <Button
                onClick={handleSave}
                disabled={loading || !formData.note.trim()}
              >
                {loading
                  ? editingId
                    ? 'Updating...'
                    : 'Creating...'
                  : editingId
                  ? 'Update'
                  : 'Add Feedback'}
              </Button>
            </div>
          </div>

          {/* List */}
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">Your Feedback</h3>
              {editingId && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={cancelEdit}
                >
                  <Plus className="h-4 w-4 mr-1" />
                  New
                </Button>
              )}
            </div>

            {feedbackList.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                No feedback yet. Add your first note above.
              </p>
            ) : (
              <div className="space-y-2">
                {feedbackList.map((feedback) => (
                  <div
                    key={feedback.id}
                    className={`border rounded-lg p-4 ${
                      editingId === feedback.id ? 'ring-2 ring-primary' : ''
                    } ${feedback.completed ? 'opacity-60' : ''}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 flex items-start gap-3">
                        <input
                          type="checkbox"
                          checked={feedback.completed || false}
                          onChange={(e) => handleToggleCompleted(feedback.id, e.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                          disabled={loading}
                        />
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            {feedback.priority && (
                              <span
                                className={`text-xs px-2 py-0.5 rounded ${
                                  feedback.priority === 'high'
                                    ? 'bg-destructive/20 text-destructive'
                                    : feedback.priority === 'medium'
                                    ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-500'
                                    : 'bg-blue-500/20 text-blue-700 dark:text-blue-500'
                                }`}
                              >
                                {feedback.priority.charAt(0).toUpperCase() +
                                  feedback.priority.slice(1)}
                              </span>
                            )}
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(feedback.created_at), 'MMM d, yyyy HH:mm')}
                            </span>
                          </div>
                          <p className={`text-sm whitespace-pre-wrap ${feedback.completed ? 'line-through text-muted-foreground' : ''}`}>
                            {feedback.note}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() =>
                            editingId === feedback.id
                              ? cancelEdit()
                              : startEdit(feedback)
                          }
                          className="h-8 w-8 p-0"
                          disabled={loading}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(feedback.id)}
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          disabled={loading}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}












