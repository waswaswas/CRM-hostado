'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  createSignature,
  updateSignature,
  deleteSignature,
  getSignatures,
  createDefaultHostadoSignature,
  EmailSignature,
} from '@/app/actions/email-signatures'
import { useToast } from '@/components/ui/toaster'
import { Plus, Trash2, Edit, Check, X, Eye, Code } from 'lucide-react'

export function SignatureEditor() {
  const router = useRouter()
  const { toast } = useToast()
  const [signatures, setSignatures] = useState<EmailSignature[]>([])
  const [editingId, setEditingId] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    name: '',
    html_content: '',
    text_content: '',
    is_default: false,
  })
  const [showPreview, setShowPreview] = useState(true)

  useEffect(() => {
    loadSignatures()
  }, [])


  async function loadSignatures() {
    try {
      setLoading(true)
      setError(null)
      const data = await getSignatures()
      setSignatures(data)
      
      // If no signatures after loading, try to create default
      if (data.length === 0) {
        try {
                    const defaultSig = await createDefaultHostadoSignature()
                    setSignatures([defaultSig])
                    toast({
                      title: 'Success',
                      description: 'Krasimir signature created',
                    })
        } catch (createError) {
          console.error('Failed to create default signature:', createError)
          // If creation fails, reload to see if it was created by another process
          try {
            const retryData = await getSignatures()
            if (retryData.length > 0) {
              setSignatures(retryData)
            } else {
              // Show error if table doesn't exist
              const errorMsg = createError instanceof Error ? createError.message : 'Unknown error'
              if (errorMsg.includes('relation') || errorMsg.includes('does not exist') || errorMsg.includes('table')) {
                setError('Email signatures table does not exist. Please run supabase/SETUP_EMAILS.sql in your Supabase SQL Editor.')
              } else {
                setError(`Failed to create signature: ${errorMsg}`)
              }
            }
          } catch (retryError) {
            console.error('Failed to reload signatures:', retryError)
            const retryMsg = retryError instanceof Error ? retryError.message : 'Unknown error'
            if (retryMsg.includes('relation') || retryMsg.includes('does not exist') || retryMsg.includes('table')) {
              setError('Email signatures table does not exist. Please run supabase/SETUP_EMAILS.sql in your Supabase SQL Editor.')
            } else {
              setError(`Failed to load signatures: ${retryMsg}`)
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to load signatures:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to load signatures'
      
      // Check if it's a database table error
      if (errorMessage.includes('relation') || errorMessage.includes('does not exist') || errorMessage.includes('table')) {
        setError('Email signatures table does not exist. Please run supabase/SETUP_EMAILS.sql in your Supabase SQL Editor.')
      } else if (errorMessage.includes('Unauthorized')) {
        setError('You are not logged in. Please log in first.')
      } else {
        setError(errorMessage)
      }
      
      toast({
        title: 'Error',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
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
      {error && (
        <Card className="border-red-200 bg-red-50 dark:bg-red-950 dark:border-red-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <X className="h-5 w-5 text-red-600 mt-0.5" />
              <div className="flex-1">
                <h3 className="font-semibold text-red-900 dark:text-red-100 mb-1">Error</h3>
                <p className="text-sm text-red-800 dark:text-red-200 mb-3">{error}</p>
                {error.includes('SETUP_EMAILS.sql') && (
                  <div className="text-sm text-red-800 dark:text-red-200">
                    <p className="font-medium mb-2">To fix this:</p>
                    <ol className="list-decimal list-inside space-y-1 ml-2">
                      <li>Go to your Supabase Dashboard</li>
                      <li>Open the SQL Editor</li>
                      <li>Copy and paste the contents of <code className="bg-red-100 dark:bg-red-900 px-1 rounded">supabase/SETUP_EMAILS.sql</code></li>
                      <li>Click "Run" to execute the SQL</li>
                      <li>Refresh this page</li>
                    </ol>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-bold">Email Signatures</h1>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={async () => {
              setLoading(true)
              try {
                await createDefaultHostadoSignature()
                toast({
                  title: 'Success',
                  description: 'Krasimir signature created successfully',
                })
                loadSignatures()
              } catch (error) {
                if (error instanceof Error && error.message.includes('already exists')) {
                  toast({
                    title: 'Info',
                    description: 'Default signature already exists',
                  })
                } else {
                  toast({
                    title: 'Error',
                    description: error instanceof Error ? error.message : 'Failed to create default signature',
                    variant: 'destructive',
                  })
                }
              } finally {
                setLoading(false)
              }
            }}
            disabled={loading}
          >
            Create Krasimir Signature
          </Button>
          <Button onClick={() => setShowForm(true)}>
            <Plus className="mr-2 h-4 w-4" />
            New Signature
          </Button>
        </div>
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
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium">HTML Content</label>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPreview(!showPreview)}
                >
                  {showPreview ? (
                    <>
                      <Code className="h-4 w-4 mr-2" />
                      Show Code
                    </>
                  ) : (
                    <>
                      <Eye className="h-4 w-4 mr-2" />
                      Show Preview
                    </>
                  )}
                </Button>
              </div>
              {showPreview ? (
                <Tabs defaultValue="code" className="mt-1">
                  <TabsList>
                    <TabsTrigger value="code">Code</TabsTrigger>
                    <TabsTrigger value="preview">Preview</TabsTrigger>
                  </TabsList>
                  <TabsContent value="code" className="mt-2">
                    <Textarea
                      value={formData.html_content}
                      onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                      placeholder="<p>Your signature HTML here</p>"
                      rows={15}
                      className="font-mono text-sm"
                    />
                  </TabsContent>
                  <TabsContent value="preview" className="mt-2">
                    <div className="border rounded-lg p-4 bg-white min-h-[200px]">
                      {formData.html_content ? (
                        <div
                          dangerouslySetInnerHTML={{ __html: formData.html_content }}
                          className="email-signature-preview"
                        />
                      ) : (
                        <p className="text-muted-foreground text-sm">Preview will appear here</p>
                      )}
                    </div>
                  </TabsContent>
                </Tabs>
              ) : (
                <Textarea
                  value={formData.html_content}
                  onChange={(e) => setFormData({ ...formData, html_content: e.target.value })}
                  placeholder="<p>Your signature HTML here</p>"
                  rows={15}
                  className="mt-1 font-mono text-sm"
                />
              )}
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

        {loading && signatures.length === 0 && (
          <Card>
            <CardContent className="p-8 text-center">
              <p className="text-muted-foreground">Loading signatures...</p>
            </CardContent>
          </Card>
        )}

        {!loading && signatures.length === 0 && !showForm && (
          <Card>
            <CardContent className="p-8 text-center space-y-4">
              <p className="text-muted-foreground">No signatures found.</p>
              <Button
                onClick={async () => {
                  setLoading(true)
                  try {
                    const defaultSig = await createDefaultHostadoSignature()
                    setSignatures([defaultSig])
                    toast({
                      title: 'Success',
                      description: 'Krasimir signature created successfully',
                    })
                  } catch (error) {
                    toast({
                      title: 'Error',
                      description: error instanceof Error ? error.message : 'Failed to create signature',
                      variant: 'destructive',
                    })
                  } finally {
                    setLoading(false)
                  }
                }}
                disabled={loading}
              >
                Create Krasimir Signature
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}














