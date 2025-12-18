'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  createSignature,
  updateSignature,
  deleteSignature,
  getSignatures,
  EmailSignature,
} from '@/app/actions/email-signatures'
import { useToast } from '@/components/ui/toaster'
import { Plus, Trash2, Edit, Check, X } from 'lucide-react'

export function SignatureEditor() {
  const router = useRouter()
  const { toast } = useToast()
  const [signatures, setSignatures] = useState<EmailSignature[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    html_content: '',
    text_content: '',
    is_default: false,
  })

  useEffect(() => {
    loadSignatures()
  }, [])

  async function loadSignatures() {
    try {
      const data = await getSignatures()
      setSignatures(data)
    } catch (error) {
      console.error('Failed to load signatures:', error)
      toast({
        title: 'Error',
        description: 'Failed to load signatures',
        variant: 'destructive',
      })
    }
  }

  function startEdit(signature: EmailSignature) {
    setEditingId(signature.id)
    setFormData({
      name: signature.name,
      html_content: signature.html_content,
      text_content: signature.text_content || '',
      is_default: signature.is_default,
    })
    setShowForm(true)
  }

  function cancelEdit() {
    setEditingId(null)
    setShowForm(false)
    setFormData({
      name: '',
      html_content: '',
      text_content: '',
      is_default: false,
    })
  }

  async function handleSave() {
    if (!formData.name || !formData.html_content) {
      toast({
        title: 'Error',
        description: 'Please fill in name and HTML content',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    try {
      if (editingId) {
        await updateSignature(editingId, formData)
        toast({
          title: 'Success',
          description: 'Signature updated successfully',
        })
      } else {
        await createSignature(formData)
        toast({
          title: 'Success',
          description: 'Signature created successfully',
        })
      }
      cancelEdit()
      loadSignatures()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to save signature',
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  async function handleDelete(signatureId: string) {
    if (!confirm('Are you sure you want to delete this signature?')) {
      return
    }

    try {
      await deleteSignature(signatureId)
      toast({
        title: 'Success',
        description: 'Signature deleted successfully',
      })
      loadSignatures()
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to delete signature',
        variant: 'destructive',
      })
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Email Signatures</h1>
        <Button onClick={() => setShowForm(true)}>
          <Plus className="mr-2 h-4 w-4" />
          New Signature
        </Button>
      </div>

      {showForm && (
        <Card>
          <CardHeader>
            <CardTitle>{editingId ? 'Edit Signature' : 'New Signature'}</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium">Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="My Signature"
                className="mt-1"
              />
            </div>

            <div>
              <label className="text-sm font-medium">HTML Content</label>
              <Textarea
                value={formData.html_content}
                onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                placeholder="<p>Your signature HTML here</p>"
                rows={8}
                className="mt-1 font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground mt-1">
                HTML is supported. Use &lt;br&gt; for line breaks, &lt;strong&gt; for bold, etc.
              </p>
            </div>

            <div>
              <label className="text-sm font-medium">Text Content (optional)</label>
              <Textarea
                value={formData.text_content}
                onChange={(e) => setFormData({ ...formData, text_content: e.target.value })}
                placeholder="Plain text version"
                rows={4}
                className="mt-1"
              />
            </div>

            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="is_default"
                checked={formData.is_default}
                onChange={(e) => setFormData({ ...formData, is_default: e.target.checked })}
                className="rounded"
              />
              <label htmlFor="is_default" className="text-sm font-medium">
                Set as default signature
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
        {signatures.map((signature) => (
          <Card key={signature.id}>
            <CardContent className="p-4">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-2">
                    <h3 className="font-semibold">{signature.name}</h3>
                    {signature.is_default && (
                      <Badge className="bg-blue-100 text-blue-800">Default</Badge>
                    )}
                  </div>
                  <div
                    className="p-3 border rounded-lg bg-muted/50"
                    dangerouslySetInnerHTML={{ __html: signature.html_content }}
                  />
                </div>
                <div className="flex items-center gap-2">
                  <Button variant="ghost" size="sm" onClick={() => startEdit(signature)}>
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(signature.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}

        {signatures.length === 0 && !showForm && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">No signatures found. Create your first signature.</p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
