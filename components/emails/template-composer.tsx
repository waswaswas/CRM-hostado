'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { RichTextEditor } from './rich-text-editor'
import { createTemplate, updateTemplate, type TemplateCategory } from '@/app/actions/email-templates'
import { useToast } from '@/components/ui/toaster'
import { Check, X } from 'lucide-react'

interface TemplateComposerProps {
  templateId?: string
  initialName?: string
  initialSubject?: string
  initialBody?: string
  initialCategory?: TemplateCategory
}

export function TemplateComposer({ 
  templateId, 
  initialName, 
  initialSubject, 
  initialBody, 
  initialCategory 
}: TemplateComposerProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [activeTab, setActiveTab] = useState<string>('edit')
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [formData, setFormData] = useState({
    name: initialName || '',
    category: initialCategory || '' as TemplateCategory | '',
    subject: initialSubject || '',
    body_html: initialBody || '',
  })

  useEffect(() => {
    if (initialName) {
      setFormData((prev) => ({ ...prev, name: initialName }))
    }
    if (initialSubject) {
      setFormData((prev) => ({ ...prev, subject: initialSubject }))
    }
    if (initialBody) {
      setFormData((prev) => ({ ...prev, body_html: initialBody }))
    }
    if (initialCategory) {
      setFormData((prev) => ({ ...prev, category: initialCategory }))
    }
  }, [initialName, initialSubject, initialBody, initialCategory])

  // Update preview when body changes
  useEffect(() => {
    let bodyWithPreview = formData.body_html || ''
    
    // Check if body contains HTML tags (from rich text editor)
    const hasHtmlTags = bodyWithPreview && /<[a-z][\s\S]*>/i.test(bodyWithPreview)
    
    if (bodyWithPreview && !hasHtmlTags) {
      // Only convert if it's plain text (doesn't contain HTML tags)
      // Split by double newlines to create paragraphs
      const paragraphs = bodyWithPreview.split(/\n\n+/)
        .map(para => para.trim())
        .filter(para => para.length > 0)
      
      if (paragraphs.length > 0) {
        bodyWithPreview = paragraphs
          .map(para => {
            // Convert single newlines within paragraph to <br>
            const withBreaks = para.replace(/\n/g, '<br>')
            return `<p style="margin: 0 0 1em 0;">${withBreaks}</p>`
          })
          .join('')
      } else {
        // If no paragraphs, convert all newlines to <br>
        const withBreaks = bodyWithPreview.replace(/\n/g, '<br>')
        bodyWithPreview = `<p style="margin: 0 0 1em 0;">${withBreaks}</p>`
      }
    }
    
    setPreviewHtml(bodyWithPreview)
  }, [formData.body_html])

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
      // Format body - preserve existing HTML from rich text editor
      let formattedBody = formData.body_html || ''
      
      // Check if body contains HTML tags (from rich text editor)
      const hasHtmlTags = formattedBody && /<[a-z][\s\S]*>/i.test(formattedBody)
      
      // Only convert if it's plain text (doesn't contain HTML tags)
      if (!hasHtmlTags && formattedBody.trim()) {
        // Split by double newlines to create paragraphs
        const paragraphs = formattedBody.split(/\n\n+/)
          .map(para => para.trim())
          .filter(para => para.length > 0)
        
        if (paragraphs.length > 0) {
          formattedBody = paragraphs
            .map(para => {
              // Convert single newlines within paragraph to <br>
              const withBreaks = para.replace(/\n/g, '<br>')
              return `<p style="margin: 0 0 1em 0;">${withBreaks}</p>`
            })
            .join('')
        } else {
          // If no paragraphs, convert all newlines to <br>
          const withBreaks = formattedBody.replace(/\n/g, '<br>')
          formattedBody = `<p style="margin: 0 0 1em 0;">${withBreaks}</p>`
        }
      }

      if (templateId) {
        await updateTemplate(templateId, {
          name: formData.name,
          category: formData.category || undefined,
          subject: formData.subject,
          body_html: formattedBody,
        })
        toast({
          title: 'Success',
          description: 'Template updated successfully',
        })
      } else {
        await createTemplate({
          name: formData.name,
          category: formData.category || undefined,
          subject: formData.subject,
          body_html: formattedBody,
        })
        toast({
          title: 'Success',
          description: 'Template created successfully',
        })
      }

      router.push('/emails/templates')
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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>{templateId ? 'Edit Template' : 'Create Template'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Template Name</label>
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
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">Body (HTML)</label>
            </div>
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
              <TabsList>
                <TabsTrigger value="edit">Edit</TabsTrigger>
                <TabsTrigger value="preview">Preview</TabsTrigger>
              </TabsList>
              <TabsContent value="edit">
                <div className="mt-1">
                  <RichTextEditor
                    value={formData.body_html}
                    onChange={(html) => setFormData({ ...formData, body_html: html })}
                    placeholder="Start typing your template..."
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Use variables like {'{{client_name}}'}, {'{{client_email}}'} in your template
                </p>
              </TabsContent>
              <TabsContent value="preview">
                <div
                  className="mt-1 p-4 border rounded-lg bg-white dark:bg-gray-900 email-body-preview min-h-[300px]"
                  dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-muted-foreground">No content to preview</p>' }}
                />
              </TabsContent>
            </Tabs>
          </div>

          <div className="flex items-center gap-2 pt-4">
            <Button onClick={handleSave} disabled={loading}>
              <Check className="h-4 w-4 mr-2" />
              {templateId ? 'Update Template' : 'Create Template'}
            </Button>
            <Button variant="ghost" onClick={() => router.back()} disabled={loading}>
              <X className="h-4 w-4 mr-2" />
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}















