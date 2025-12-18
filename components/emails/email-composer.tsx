'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { createEmail, sendEmailNow, scheduleEmail } from '@/app/actions/emails'
import { getClients as getClientsList } from '@/app/actions/clients'
import { getSignatures } from '@/app/actions/email-signatures'
import { getTemplates } from '@/app/actions/email-templates'
import { renderTemplate } from '@/lib/email-template-utils'
import { useToast } from '@/components/ui/toaster'
import { Client } from '@/types/database'
import { EmailSignature, EmailTemplate } from '@/app/actions/email-signatures'
import type { EmailTemplate as TemplateType } from '@/app/actions/email-templates'
import { Calendar, Send, Clock, X, Mail } from 'lucide-react'
import { format } from 'date-fns'

interface EmailComposerProps {
  clientId?: string
  initialSubject?: string
  initialBody?: string
  templateId?: string
}

export function EmailComposer({ clientId, initialSubject, initialBody, templateId }: EmailComposerProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [signatures, setSignatures] = useState<EmailSignature[]>([])
  const [templates, setTemplates] = useState<TemplateType[]>([])
  const [selectedClient, setSelectedClient] = useState<string>(clientId || '')
  const [selectedTemplate, setSelectedTemplate] = useState<string>(templateId || '')
  const [selectedSignature, setSelectedSignature] = useState<string>('')
  const [showSchedule, setShowSchedule] = useState(false)
  const [scheduledDate, setScheduledDate] = useState('')
  const [scheduledTime, setScheduledTime] = useState('')
  const [formData, setFormData] = useState({
    subject: initialSubject || '',
    body_html: initialBody || '',
    to_email: '',
    to_name: '',
    cc_emails: '',
    bcc_emails: '',
  })

  useEffect(() => {
    async function loadData() {
      try {
        const [clientsData, signaturesData, templatesData] = await Promise.all([
          getClientsList(),
          getSignatures(),
          getTemplates(),
        ])
        setClients(clientsData)
        setSignatures(signaturesData)
        setTemplates(templatesData)

        // Set default signature
        const defaultSignature = signaturesData.find((s) => s.is_default)
        if (defaultSignature) {
          setSelectedSignature(defaultSignature.id)
        }
      } catch (error) {
        console.error('Failed to load data:', error)
      }
    }
    loadData()
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
        setFormData((prev) => ({
          ...prev,
          to_email: client.email || '',
          to_name: client.name,
        }))
      }
    }
  }, [selectedClient, clients])

  useEffect(() => {
    if (templateId && !selectedTemplate) {
      setSelectedTemplate(templateId)
    }
  }, [templateId])

  useEffect(() => {
    if (selectedTemplate) {
      const template = templates.find((t) => t.id === selectedTemplate)
      if (template) {
        const client = clients.find((c) => c.id === selectedClient)
        const variables: any = {
          client_name: client?.name || '',
          client_email: client?.email || '',
          client_company: client?.company || '',
        }
        setFormData((prev) => ({
          ...prev,
          subject: renderTemplate(template.subject, variables),
          body_html: renderTemplate(template.body_html, variables),
        }))
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
      const email = await createEmail({
        client_id: selectedClient,
        subject: formData.subject,
        body_html: formData.body_html,
        body_text: formData.body_html.replace(/<[^>]*>/g, ''),
        to_email: formData.to_email,
        to_name: formData.to_name,
        cc_emails: formData.cc_emails ? formData.cc_emails.split(',').map((e) => e.trim()) : undefined,
        bcc_emails: formData.bcc_emails ? formData.bcc_emails.split(',').map((e) => e.trim()) : undefined,
        signature_id: selectedSignature || null,
        template_id: selectedTemplate || null,
      })

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

    if (!scheduledDate || !scheduledTime) {
      toast({
        title: 'Error',
        description: 'Please select date and time',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      const scheduledAt = new Date(`${scheduledDate}T${scheduledTime}`).toISOString()

      const email = await createEmail({
        client_id: selectedClient,
        subject: formData.subject,
        body_html: formData.body_html,
        body_text: formData.body_html.replace(/<[^>]*>/g, ''),
        to_email: formData.to_email,
        to_name: formData.to_name,
        cc_emails: formData.cc_emails ? formData.cc_emails.split(',').map((e) => e.trim()) : undefined,
        bcc_emails: formData.bcc_emails ? formData.bcc_emails.split(',').map((e) => e.trim()) : undefined,
        signature_id: selectedSignature || null,
        template_id: selectedTemplate || null,
        scheduled_at: scheduledAt,
      })

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
      await createEmail({
        client_id: selectedClient,
        subject: formData.subject || '(No subject)',
        body_html: formData.body_html || '',
        body_text: formData.body_html.replace(/<[^>]*>/g, ''),
        to_email: formData.to_email,
        to_name: formData.to_name,
        cc_emails: formData.cc_emails ? formData.cc_emails.split(',').map((e) => e.trim()) : undefined,
        bcc_emails: formData.bcc_emails ? formData.bcc_emails.split(',').map((e) => e.trim()) : undefined,
        signature_id: selectedSignature || null,
        template_id: selectedTemplate || null,
      })

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
            >
              <option value="">Select a client</option>
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
                onChange={(e) => setSelectedTemplate(e.target.value)}
                className="mt-1"
              >
                <option value="">No template</option>
                {templates.map((template) => (
                  <option key={template.id} value={template.id}>
                    {template.name}
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <label className="text-sm font-medium">Signature</label>
              <Select
                value={selectedSignature}
                onChange={(e) => setSelectedSignature(e.target.value)}
                className="mt-1"
              >
                <option value="">No signature</option>
                {signatures.map((signature) => (
                  <option key={signature.id} value={signature.id}>
                    {signature.name} {signature.is_default && '(Default)'}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Body (HTML)</label>
            <Textarea
              value={formData.body_html}
              onChange={(e) => setFormData({ ...formData, body_html: e.target.value })}
              placeholder="Email body (HTML supported)"
              rows={12}
              className="mt-1 font-mono text-sm"
            />
            <p className="text-xs text-muted-foreground mt-1">
              HTML is supported. Use &lt;br&gt; for line breaks, &lt;strong&gt; for bold, etc.
            </p>
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
            <Button onClick={handleSend} disabled={loading}>
              <Send className="h-4 w-4 mr-2" />
              Send
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
