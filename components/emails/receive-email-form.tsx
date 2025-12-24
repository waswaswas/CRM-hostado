'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Select } from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { RichTextEditor } from './rich-text-editor'
import { createInboundEmail } from '@/app/actions/emails'
import { getClients as getClientsList } from '@/app/actions/clients'
import { useToast } from '@/components/ui/toaster'
import { Client } from '@/types/database'
import { ArrowLeft, Mail } from 'lucide-react'
import { format } from 'date-fns'

export function ReceiveEmailForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [loading, setLoading] = useState(false)
  const [clients, setClients] = useState<Client[]>([])
  const [selectedClient, setSelectedClient] = useState<string>('')
  const [formData, setFormData] = useState({
    from_email: '',
    from_name: '',
    subject: '',
    body_html: '',
    to_email: '',
    to_name: '',
    cc_emails: '',
    received_at: format(new Date(), "yyyy-MM-dd'T'HH:mm"),
  })

  useEffect(() => {
    async function loadClients() {
      try {
        const clientsData = await getClientsList()
        setClients(clientsData)
      } catch (error) {
        console.error('Failed to load clients:', error)
      }
    }
    loadClients()
  }, [])

  async function handleSubmit() {
    if (!formData.from_email || !formData.subject || !formData.body_html) {
      toast({
        title: 'Error',
        description: 'Please fill in From Email, Subject, and Body',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      await createInboundEmail({
        client_id: selectedClient || undefined,
        from_email: formData.from_email,
        from_name: formData.from_name || formData.from_email.split('@')[0],
        subject: formData.subject,
        body_html: formData.body_html,
        body_text: formData.body_html.replace(/<[^>]*>/g, ''),
        to_email: formData.to_email || undefined,
        to_name: formData.to_name || undefined,
        cc_emails: formData.cc_emails ? formData.cc_emails.split(',').map((e) => e.trim()) : undefined,
        received_at: formData.received_at,
      })

      toast({
        title: 'Success',
        description: 'Received email added to inbox',
      })

      router.push('/emails')
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to add received email',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-3xl font-bold">Add Received Email</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Email Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="text-sm font-medium">Client (Optional - will be created if not found)</label>
            <Select
              value={selectedClient}
              onChange={(e) => setSelectedClient(e.target.value)}
              className="mt-1"
            >
              <option value="">Auto-detect from email</option>
              {clients.map((client) => (
                <option key={client.id} value={client.id}>
                  {client.name} {client.email ? `(${client.email})` : ''}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground mt-1">
              If no client is selected, a new client will be created from the sender's email
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">From Email *</label>
              <Input
                value={formData.from_email}
                onChange={(e) => setFormData({ ...formData, from_email: e.target.value })}
                placeholder="sender@example.com"
                className="mt-1"
                type="email"
              />
            </div>

            <div>
              <label className="text-sm font-medium">From Name</label>
              <Input
                value={formData.from_name}
                onChange={(e) => setFormData({ ...formData, from_name: e.target.value })}
                placeholder="Sender Name"
                className="mt-1"
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="text-sm font-medium">To Email</label>
              <Input
                value={formData.to_email}
                onChange={(e) => setFormData({ ...formData, to_email: e.target.value })}
                placeholder="your@email.com (auto-filled if empty)"
                className="mt-1"
                type="email"
              />
            </div>

            <div>
              <label className="text-sm font-medium">Received At</label>
              <Input
                type="datetime-local"
                value={formData.received_at}
                onChange={(e) => setFormData({ ...formData, received_at: e.target.value })}
                className="mt-1"
              />
            </div>
          </div>

          <div>
            <label className="text-sm font-medium">Subject *</label>
            <Input
              value={formData.subject}
              onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
              placeholder="Email subject"
              className="mt-1"
            />
          </div>

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
            <label className="text-sm font-medium">Body (HTML) *</label>
            <div className="mt-1">
              <RichTextEditor
                value={formData.body_html}
                onChange={(html) => setFormData({ ...formData, body_html: html })}
                placeholder="Email body content..."
              />
            </div>
          </div>

          <div className="flex items-center gap-2 pt-4">
            <Button onClick={handleSubmit} disabled={loading}>
              <Mail className="h-4 w-4 mr-2" />
              Add to Inbox
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

