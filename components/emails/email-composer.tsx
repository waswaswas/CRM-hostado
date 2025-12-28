'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { RichTextEditor } from './rich-text-editor'
import { createEmail, sendEmailNow, scheduleEmail } from '@/app/actions/emails'
import { getClients as getClientsList } from '@/app/actions/clients'
import { getSignatures, createDefaultHostadoSignature } from '@/app/actions/email-signatures'
import { getTemplates, ensureDefaultBasicTemplate } from '@/app/actions/email-templates'
import { renderTemplate } from '@/lib/email-template-utils'
import { useToast } from '@/components/ui/toaster'
import { Client } from '@/types/database'
import { EmailSignature, EmailTemplate } from '@/app/actions/email-signatures'
import type { EmailTemplate as TemplateType } from '@/app/actions/email-templates'
import { Calendar, Send, Clock, X, Mail, Paperclip, XCircle } from 'lucide-react'
import { format } from 'date-fns'

interface EmailComposerProps {
  clientId?: string
  initialSubject?: string
  initialBody?: string
  initialToEmail?: string
  initialToName?: string
  templateId?: string
}

export function EmailComposer({ clientId, initialSubject, initialBody, initialToEmail, initialToName, templateId }: EmailComposerProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [loadingData, setLoadingData] = useState(true)
  const [clients, setClients] = useState<Client[]>([])
  const [signatures, setSignatures] = useState<EmailSignature[]>([])
  const [templates, setTemplates] = useState<TemplateType[]>([])
  const [selectedClient, setSelectedClient] = useState<string>(clientId || '')
  const [selectedTemplate, setSelectedTemplate] = useState<string>(templateId || '')
  const [selectedSignature, setSelectedSignature] = useState<string>('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [previewHtml, setPreviewHtml] = useState<string>('')
  const [activeTab, setActiveTab] = useState<string>('edit')
  const [attachments, setAttachments] = useState<File[]>([])
  const [uploadingAttachments, setUploadingAttachments] = useState(false)
  const [formData, setFormData] = useState({
    subject: initialSubject || '',
    body_html: initialBody || '',
    to_email: initialToEmail || '',
    to_name: initialToName || '',
    cc_emails: '',
    bcc_emails: '',
  })

  useEffect(() => {
    async function loadData() {
      setLoadingData(true)
      try {
        // Ensure default Basic template exists first
        const basicTemplateCreated = await ensureDefaultBasicTemplate()
        
        // Load clients and signatures
        const [clientsData, signaturesData] = await Promise.all([
          getClientsList(),
          getSignatures(),
        ])
        setClients(clientsData)
        setSignatures(signaturesData)
        
        // Load templates (reload to ensure Basic is included if it was just created)
        const templatesData = await getTemplates()
        setTemplates(templatesData)

        // Set default signature
        const defaultSignature = signaturesData.find((s) => s.is_default)
        if (defaultSignature) {
          setSelectedSignature(defaultSignature.id)
        } else if (signaturesData.length > 0) {
          // If no default but signatures exist, select first one
          setSelectedSignature(signaturesData[0].id)
        } else {
          // If no signatures, try to create default
          try {
            const { createDefaultHostadoSignature } = await import('@/app/actions/email-signatures')
            const defaultSig = await createDefaultHostadoSignature()
            setSignatures([defaultSig])
            setSelectedSignature(defaultSig.id)
            toast({
              title: 'Success',
              description: 'Krasimir signature created and selected',
            })
          } catch (createError) {
            console.error('Failed to auto-create signature:', createError)
            // Don't show error toast - user can create manually
          }
        }
      } catch (error) {
        console.error('Failed to load data:', error)
        const errorMessage = error instanceof Error ? error.message : 'Failed to load email data'
        toast({
          title: 'Error',
          description: errorMessage.includes('relation') || errorMessage.includes('does not exist')
            ? 'Email tables not set up. Please run supabase/SETUP_EMAILS.sql'
            : errorMessage,
          variant: 'destructive',
        })
      } finally {
        setLoadingData(false)
      }
    }
    loadData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (clientId && !selectedClient) {
      setSelectedClient(clientId)
    }
  }, [clientId])

  useEffect(() => {
    if (selectedClient) {
      const client = clients.find((c) => c.id === selectedClient)
      if (client) {
        // Extract first name from client name
        const firstName = client.name.split(' ')[0] || client.name
        
        setFormData((prev) => {
          const newData = {
            ...prev,
            to_email: client.email || '',
            to_name: client.name,
          }
          
          // Auto-fill greeting only if body is completely empty (not when template is selected)
          if ((!prev.body_html || prev.body_html.trim() === '') && !selectedTemplate) {
            const greeting = `Здравейте, ${firstName},`
            newData.body_html = `<p style="margin: 0 0 1em 0;">${greeting}</p>`
          } else if (prev.body_html && prev.body_html.includes('{{client_first_name}}')) {
            // If template has variable, replace it with actual first name
            newData.body_html = prev.body_html.replace(/\{\{client_first_name\}\}/g, firstName)
          } else if (prev.body_html && prev.body_html.includes('Здравейте,') && !prev.body_html.includes(firstName)) {
            // If greeting exists but doesn't have the name, update it
            newData.body_html = prev.body_html.replace(
              /Здравейте,\s*[^,<]*,/g,
              `Здравейте, ${firstName},`
            )
          }
          
          return newData
        })
      }
    }
  }, [selectedClient, clients, selectedTemplate])

  useEffect(() => {
    if (templateId && !selectedTemplate) {
      setSelectedTemplate(templateId)
    }
  }, [templateId, selectedTemplate])

  // Auto-select Basic template when templates are loaded (only if no template is selected and no templateId prop)
  useEffect(() => {
    if (!templateId && !selectedTemplate && templates.length > 0) {
      const basicTemplate = templates.find((t) => t.name === 'Basic')
      if (basicTemplate) {
        setSelectedTemplate(basicTemplate.id)
      }
    }
  }, [templates, templateId, selectedTemplate])

  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find((t) => t.id === selectedTemplate)
      if (template) {
        const client = clients.find((c) => c.id === selectedClient)
        // Extract first name from client name
        const firstName = client?.name ? client.name.split(' ')[0] : ''
        const variables: any = {
          client_name: client?.name || '',
          client_first_name: firstName || '{{client_first_name}}', // Keep placeholder if no client selected
          client_email: client?.email || '',
          client_company: client?.company || '',
        }
        setFormData((prev) => ({
          ...prev,
          subject: renderTemplate(template.subject, variables),
          body_html: renderTemplate(template.body_html, variables),
        }))
      }
    } else if (selectedClient && !selectedTemplate) {
      // If no template selected but client is selected, ensure greeting has first name
      const client = clients.find((c) => c.id === selectedClient)
      if (client) {
        const firstName = client.name.split(' ')[0] || client.name
        setFormData((prev) => {
          if (prev.body_html && prev.body_html.includes('{{client_first_name}}')) {
            return {
              ...prev,
              body_html: prev.body_html.replace(/\{\{client_first_name\}\}/g, firstName),
            }
          }
          return prev
        })
      }
    }
  }, [selectedTemplate, templates, selectedClient, clients])

  useEffect(() => {
    if (initialSubject) {
      setFormData((prev) => ({ ...prev, subject: initialSubject }))
    }
    if (initialBody) {
      setFormData((prev) => ({ ...prev, body_html: initialBody }))
    }
  }, [initialSubject, initialBody])

  // Update preview when body or signature changes (signature is NOT added to body_html in Edit mode)
  useEffect(() => {
    let bodyWithSignature = formData.body_html || ''
    
    // Check if body contains HTML tags (from rich text editor)
    const hasHtmlTags = bodyWithSignature && /<[a-z][\s\S]*>/i.test(bodyWithSignature)
    
    if (bodyWithSignature && !hasHtmlTags) {
      // Only convert if it's plain text (doesn't contain HTML tags)
      // Split by double newlines to create paragraphs
      const paragraphs = bodyWithSignature.split(/\n\n+/)
        .map(para => para.trim())
        .filter(para => para.length > 0)
      
      if (paragraphs.length > 0) {
        bodyWithSignature = paragraphs
          .map(para => {
            // Convert single newlines within paragraph to <br>
            const withBreaks = para.replace(/\n/g, '<br>')
            return `<p style="margin: 0 0 1em 0;">${withBreaks}</p>`
          })
          .join('')
      } else {
        // If no paragraphs, convert all newlines to <br>
        const withBreaks = bodyWithSignature.replace(/\n/g, '<br>')
        bodyWithSignature = `<p style="margin: 0 0 1em 0;">${withBreaks}</p>`
      }
    }
    
    // Add signature with proper spacing
    if (selectedSignature) {
      const signature = signatures.find((s) => s.id === selectedSignature)
      if (signature && signature.html_content) {
        // Only add if not already in body
        if (!bodyWithSignature.includes(signature.html_content)) {
          // Add single <br> before signature for spacing
          bodyWithSignature = bodyWithSignature 
            ? `${bodyWithSignature}<br>${signature.html_content}`
            : signature.html_content
        }
      }
    }
    
    setPreviewHtml(bodyWithSignature)
  }, [formData.body_html, selectedSignature, signatures])

  async function handleSend() {
    if (!selectedClient) {
      toast({
        title: 'Error',
        description: 'Please select a client',
        variant: 'destructive',
      })
      return
    }

    if (!formData.subject || !formData.body_html) {
      toast({
        title: 'Error',
        description: 'Please fill in subject and body',
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

      const email = await createEmail({
        client_id: selectedClient,
        subject: formData.subject,
        body_html: formattedBody,
        body_text: formattedBody.replace(/<[^>]*>/g, ''),
        to_email: formData.to_email,
        to_name: formData.to_name,
        cc_emails: formData.cc_emails ? formData.cc_emails.split(',').map((e) => e.trim()) : undefined,
        bcc_emails: formData.bcc_emails ? formData.bcc_emails.split(',').map((e) => e.trim()) : undefined,
        signature_id: selectedSignature || null,
        template_id: selectedTemplate || null,
      })

      // Upload attachments if any
      if (attachments.length > 0) {
        setUploadingAttachments(true)
        try {
          const { uploadEmailAttachment } = await import('@/app/actions/email-attachments')
          await Promise.all(
            attachments.map((file) => {
              const formData = new FormData()
              formData.append('file', file)
              return uploadEmailAttachment(email.id, formData)
            })
          )
        } catch (error) {
          console.error('Failed to upload attachments:', error)
          toast({
            title: 'Warning',
            description: 'Email sent but some attachments failed to upload',
            variant: 'destructive',
          })
        } finally {
          setUploadingAttachments(false)
        }
      }

      await sendEmailNow(email.id)

      toast({
        title: 'Success',
        description: 'Email sent successfully',
      })

      router.push('/emails')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to send email',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSchedule() {
    if (!selectedClient) {
      toast({
        title: 'Error',
        description: 'Please select a client',
        variant: 'destructive',
      })
      return
    }

    if (!formData.subject || !formData.body_html) {
      toast({
        title: 'Error',
        description: 'Please fill in subject and body',
        variant: 'destructive',
      })
      return
    }

    if (!scheduledDate) {
      toast({
        title: 'Error',
        description: 'Please select a date',
        variant: 'destructive',
      })
      return
    }

    if (!scheduledTime) {
      toast({
        title: 'Error',
        description: 'Please select a time',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()

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

      const email = await createEmail({
        client_id: selectedClient,
        subject: formData.subject,
        body_html: formattedBody,
        body_text: formattedBody.replace(/<[^>]*>/g, ''),
        to_email: formData.to_email,
        to_name: formData.to_name,
        cc_emails: formData.cc_emails ? formData.cc_emails.split(',').map((e) => e.trim()) : undefined,
        bcc_emails: formData.bcc_emails ? formData.bcc_emails.split(',').map((e) => e.trim()) : undefined,
        signature_id: selectedSignature || null,
        template_id: selectedTemplate || null,
        scheduled_at: scheduledAt,
      })

      // Upload attachments if any
      if (attachments.length > 0) {
        setUploadingAttachments(true)
        try {
          const { uploadEmailAttachment } = await import('@/app/actions/email-attachments')
          await Promise.all(
            attachments.map((file) => {
              const formData = new FormData()
              formData.append('file', file)
              return uploadEmailAttachment(email.id, formData)
            })
          )
        } catch (error) {
          console.error('Failed to upload attachments:', error)
          toast({
            title: 'Warning',
            description: 'Email scheduled but some attachments failed to upload',
            variant: 'destructive',
          })
        } finally {
          setUploadingAttachments(false)
        }
      }

      toast({
        title: 'Success',
        description: 'Email scheduled successfully',
      })

      router.push('/emails')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to schedule email',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveDraft() {
    if (!selectedClient) {
      toast({
        title: 'Error',
        description: 'Please select a client',
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

      const email = await createEmail({
        client_id: selectedClient,
        subject: formData.subject || '(No subject)',
        body_html: formattedBody,
        body_text: formattedBody.replace(/<[^>]*>/g, ''),
        to_email: formData.to_email,
        to_name: formData.to_name,
        cc_emails: formData.cc_emails ? formData.cc_emails.split(',').map((e) => e.trim()) : undefined,
        bcc_emails: formData.bcc_emails ? formData.bcc_emails.split(',').map((e) => e.trim()) : undefined,
        signature_id: selectedSignature || null,
        template_id: selectedTemplate || null,
      })

      // Upload attachments if any
      if (attachments.length > 0) {
        setUploadingAttachments(true)
        try {
          const { uploadEmailAttachment } = await import('@/app/actions/email-attachments')
          await Promise.all(
            attachments.map((file) => {
              const formData = new FormData()
              formData.append('file', file)
              return uploadEmailAttachment(email.id, formData)
            })
          )
        } catch (error) {
          console.error('Failed to upload attachments:', error)
          toast({
            title: 'Warning',
            description: 'Draft saved but some attachments failed to upload',
            variant: 'destructive',
          })
        } finally {
          setUploadingAttachments(false)
        }
      }

      toast({
        title: 'Success',
        description: 'Draft saved successfully',
      })

      router.push('/emails')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save draft',
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
          <CardTitle>Compose Email</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Client</label>
            <Select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="mt-1"
              disabled={loadingData}
            >
              <option value="">
                {loadingData ? 'Loading clients...' : 'Select a client'}
              </option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.email ? `(${client.email})` : ''}
                </option>
              ))}
            </Select>
          </div>

          <div>
            <label className="text-sm font-medium">To</label>
            <Input
              value={formData.to_email}
              onChange={(e) => setFormData({ ...formData, to_email: e.target.value })}
              placeholder="recipient@example.com"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">To Name</label>
            <Input
              value={formData.to_name}
              onChange={(e) => setFormData({ ...formData, to_name: e.target.value })}
              placeholder="Recipient Name"
              className="mt-1"
            />
          </div>

          <div>
            <label className="text-sm font-medium">Subject</label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Email subject"
              className="mt-1"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">Template</label>
              <Select
                value={selectedTemplate}
                onChange={(e) => {
                  if (e.target.value === '__create_template__') {
                    router.push('/emails/templates/new')
                  } else {
                    setSelectedTemplate(e.target.value)
                  }
                }}
                className="mt-1"
                disabled={loadingData}
              >
                <option value="">
                  {loadingData ? 'Loading templates...' : 'No template'}
                </option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
                <option value="__create_template__">+ Create Template</option>
              </Select>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-sm font-medium">Signature</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={async () => {
                    try {
                      const signaturesData = await getSignatures()
                      setSignatures(signaturesData)
                      const defaultSig = signaturesData.find((s) => s.is_default)
                      if (defaultSig) {
                        setSelectedSignature(defaultSig.id)
                      }
                      toast({
                        title: 'Success',
                        description: 'Signatures refreshed',
                      })
                    } catch (error) {
                      toast({
                        title: 'Error',
                        description: 'Failed to refresh signatures',
                        variant: 'destructive',
                      })
                    }
                  }}
                  className="h-6 text-xs"
                >
                  Refresh
                </Button>
              </div>
              <div className="space-y-2">
                <Select
                  value={selectedSignature}
                  onChange={(e) => {
                    setSelectedSignature(e.target.value)
                    // The useEffect will handle adding the signature to body_html
                  }}
                  className="mt-1"
                  disabled={loadingData}
                >
                  <option value="">
                    {loadingData ? 'Loading signatures...' : 'No signature'}
                  </option>
                  {signatures.length === 0 && !loadingData ? (
                    <option value="" disabled>No signatures available</option>
                  ) : (
                    signatures.map((signature) => (
                      <option key={signature.id} value={signature.id}>
                        {signature.name} {signature.is_default && '(Default)'}
                      </option>
                    ))
                  )}
                </Select>
                {signatures.length === 0 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={async () => {
                      try {
                        await createDefaultHostadoSignature()
                        const signaturesData = await getSignatures()
                        setSignatures(signaturesData)
                        const defaultSig = signaturesData.find((s) => s.is_default)
                        if (defaultSig) {
                          setSelectedSignature(defaultSig.id)
                        }
                        toast({
                          title: 'Success',
                          description: 'Krasimir signature created',
                        })
                      } catch (error) {
                        toast({
                          title: 'Error',
                          description: error instanceof Error ? error.message : 'Failed to create signature',
                          variant: 'destructive',
                        })
                      }
                    }}
                    className="w-full text-xs"
                  >
                    Create Krasimir Signature
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="text-sm font-medium">Body (HTML)</label>
              <div className="flex items-center gap-2">
                <input
                  type="file"
                  id="file-attachment"
                  multiple
                  accept=".png,.jpg,.jpeg,.pdf,.doc,.docx,.mp4,.mov,.avi,.webm,image/*,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,video/*"
                  className="hidden"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || [])
                    // Validate file types
                    const allowedTypes = [
                      'image/png',
                      'image/jpeg',
                      'image/jpg',
                      'application/pdf',
                      'application/msword',
                      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
                      'video/mp4',
                      'video/quicktime',
                      'video/x-msvideo',
                      'video/webm',
                    ]
                    const allowedExtensions = ['png', 'jpg', 'jpeg', 'pdf', 'doc', 'docx', 'mp4', 'mov', 'avi', 'webm']
                    
                    const validFiles: File[] = []
                    const invalidFiles: string[] = []
                    
                    files.forEach((file) => {
                      const fileExtension = file.name.split('.').pop()?.toLowerCase()
                      if (
                        allowedTypes.includes(file.type) ||
                        allowedExtensions.includes(fileExtension || '')
                      ) {
                        // Check file size (25MB max)
                        if (file.size <= 25 * 1024 * 1024) {
                          validFiles.push(file)
                        } else {
                          invalidFiles.push(`${file.name} (exceeds 25MB)`)
                        }
                      } else {
                        invalidFiles.push(file.name)
                      }
                    })
                    
                    if (invalidFiles.length > 0) {
                      toast({
                        title: 'Invalid Files',
                        description: `Some files were not added: ${invalidFiles.join(', ')}. Allowed: PNG, JPEG, PDF, Word, Videos (max 25MB)`,
                        variant: 'destructive',
                      })
                    }
                    
                    if (validFiles.length > 0) {
                      setAttachments((prev) => [...prev, ...validFiles])
                    }
                    
                    // Reset input
                    e.target.value = ''
                  }}
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => document.getElementById('file-attachment')?.click()}
                  disabled={uploadingAttachments}
                >
                  <Paperclip className="h-4 w-4 mr-2" />
                  Attach Files
                </Button>
              </div>
            </div>
            {attachments.length > 0 && (
              <div className="mt-2 space-y-2">
                {attachments.map((file, index) => (
                  <div
                    key={index}
                    className="flex items-center justify-between p-2 bg-muted rounded-lg text-sm"
                  >
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <Paperclip className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                      <span className="truncate" title={file.name}>
                        {file.name}
                      </span>
                      <span className="text-xs text-muted-foreground flex-shrink-0">
                        ({(file.size / 1024 / 1024).toFixed(2)} MB)
                      </span>
                    </div>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setAttachments((prev) => prev.filter((_, i) => i !== index))
                      }}
                      className="h-6 w-6 p-0"
                    >
                      <XCircle className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
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
                    placeholder="Start typing your email..."
                  />
                </div>
              </TabsContent>
              <TabsContent value="preview">
                <div
                  className="mt-1 p-4 border rounded-lg bg-white dark:bg-gray-900 email-body-preview min-h-[300px]"
                  dangerouslySetInnerHTML={{ __html: previewHtml || '<p class="text-muted-foreground">No content to preview</p>' }}
                />
                {selectedSignature && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Signature "{signatures.find((s) => s.id === selectedSignature)?.name || 'selected'}" is included in preview
                  </p>
                )}
              </TabsContent>
            </Tabs>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">CC (comma-separated)</label>
              <Input
                value={formData.cc_emails}
                onChange={(e) => setFormData({ ...formData, cc_emails: e.target.value })}
                placeholder="cc1@example.com, cc2@example.com"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">BCC (comma-separated)</label>
              <Input
                value={formData.bcc_emails}
                onChange={(e) => setFormData({ ...formData, bcc_emails: e.target.value })}
                placeholder="bcc1@example.com, bcc2@example.com"
                className="mt-1"
              />
            </div>
          </div>

          {showSchedule && (
            <div className="border rounded-lg p-4 space-y-4 bg-muted/50">
              <div className="flex items-center justify-between">
                <h3 className="font-medium">Schedule Email</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowSchedule(false)}
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="text-sm font-medium">Date</label>
                  <Input
                    type="date"
                    value={scheduledDate}
                    onChange={(e) => setScheduledDate(e.target.value)}
                    min={format(new Date(), 'yyyy-MM-dd')}
                    className="mt-1"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium">Time</label>
                  <Input
                    type="time"
                    value={scheduledTime}
                    onChange={(e) => setScheduledTime(e.target.value)}
                    className="mt-1"
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex items-center gap-2 pt-4">
            <Button onClick={handleSend} disabled={loading || uploadingAttachments}>
              <Send className="h-4 w-4 mr-2" />
              {uploadingAttachments ? 'Uploading...' : 'Send'}
            </Button>
            <Button
              variant="outline"
              onClick={() => setShowSchedule(!showSchedule)}
              disabled={loading}
            >
              <Clock className="h-4 w-4 mr-2" />
              Schedule
            </Button>
            {showSchedule && (
              <Button onClick={handleSchedule} disabled={loading}>
                <Calendar className="h-4 w-4 mr-2" />
                Schedule Now
              </Button>
            )}
            <Button variant="outline" onClick={handleSaveDraft} disabled={loading}>
              Save Draft
            </Button>
            <Button variant="ghost" onClick={() => router.back()} disabled={loading}>
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}














