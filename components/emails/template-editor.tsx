'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  createTemplate,
  updateTemplate,
  deleteTemplate,
  getTemplates,
  EmailTemplate,
  TemplateCategory,
} from '@/app/actions/email-templates'
import { useToast } from '@/components/ui/toaster'
import { Plus, Trash2, Edit, Check, X } from 'lucide-react'

export function TemplateEditor() {
  const router = useRouter()
  const { toast } = useToast()
  const [templates, setTemplates] = useState<EmailTemplate[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    category: '' as TemplateCategory | '',
    subject: '',
    body_html: '',
    body_text: '',
    is_shared: false,
  })

  useEffect(() => {
    loadTemplates()
  }, [])

  async function loadTemplates() {
    try {
      const data = await getTemplates()
      setTemplates(data)
    } catch (error) {
      console.error('Failed to load templates:', error)
      toast({
        title: 'Error',
        description: 'Failed to load templates',
        variant: 'destructive',
      })
    }
  }

  function startEdit(template: EmailTemplate) {
    setEditingId(template.id)
    setFormData({
      name: template.name,
      category: template.category || '',
      subject: template.subject,
      body_html: template.body_html,
      body_text: template.body_text || '',
      is_shared: template.is_shared,
    })
    setShowForm(true)
  }

  function cancelEdit() {
    setEditingId(null)
    setShowForm(false)
    setFormData({
      name: '',
      category: '',
      subject: '',
      body_html: '',
      body_text: '',
      is_shared: false,
    })
  }

  async function handleSave() {
    if (!formData.name || !formData.subject || !formData.body_html) {
      toast({
        title: 'Error',
        description: 'Please fill in name, subject, and body',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      if (editingId) {
        await updateTemplate(editingId, {
          ...formData,
          category: formData.category || undefined,
        })
        toast({
          title: 'Success',
          description: 'Template updated successfully',
        })
      } else {
        await createTemplate({
          ...formData,
          category: formData.category || undefined,
        })
        toast({
          title: 'Success',
          description: 'Template created successfully',
        })
      }
      cancelEdit()
      loadTemplates()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save template',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(templateId: string) {
    if (!confirm('Are you sure you want to delete this template?')) {
      return
    }

    try {
      await deleteTemplate(templateId)
      toast({
        title: 'Success',
        description: 'Template deleted successfully',
      })
      loadTemplates()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete template',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Email Templates</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Template
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Template' : 'New Template'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Template Name"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Category</label>
              <Select
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value as TemplateCategory })}
                className="mt-1"
              >
                <option value="">None</option>
                <option value="follow_up">Follow Up</option>
                <option value="offer">Offer</option>
                <option value="welcome">Welcome</option>
                <option value="custom">Custom</option>
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Subject</label>
              <Input
                value={formData.subject}
                onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                placeholder="Email subject (use {{variable_name}} for variables)"
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Use variables like {'{{client_name}}'}, {'{{client_email}}'}, {'{{offer_amount}}'}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Body (HTML)</label>
              <Textarea
                value={formData.body_html}
                onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
                placeholder="Email body HTML (use {{variable_name}} for variables)"
                rows={12}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                HTML is supported. Use variables like {'{{client_name}}'}, {'{{client_email}}'}
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Body (Text, optional)</label>
              <Textarea
                value={formData.body_text}
                onChange={(e) => setFormData({ ...formData, body_text: e.target.value })}
                placeholder="Plain text version"
                rows={6}
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_shared"
                checked={formData.is_shared}
                onChange={(e) => setFormData({ ...formData, is_shared: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="is_shared" className="text-sm font-medium">
                Share with team
              </label>
            </div>

            <div className="flex items-center gap-2 pt-4">
              <Button onClick={handleSave} disabled={loading}>
                <Check className="h-4 w-4 mr-2" />
                Save
              </Button>
              <Button variant="outline" onClick={cancelEdit} disabled={loading}>
                <X className="h-4 w-4 mr-2" />
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="space-y-4">
        {templates.map((template) => (
          <Card key={template.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{template.name}</h3>
                    {template.category && (
                      <span className="text-xs text-muted-foreground">({template.category})</span>
                    )}
                    {template.is_shared && (
                      <span className="text-xs text-blue-600">Shared</span>
                    )}
                  </div>
                  <div className="text-sm text-muted-foreground mb-2">
                    <strong>Subject:</strong> {template.subject}
                  </div>
                  <div
                    className="p-3 border rounded-lg bg-muted/50 text-sm"
                    dangerouslySetInnerHTML={{ __html: template.body_html }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(template)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(template.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {templates.length === 0 && !showForm && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No templates found. Create your first template.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}














