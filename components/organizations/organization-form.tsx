'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { createOrganization } from '@/app/actions/organizations'
import { useToast } from '@/components/ui/toaster'
import { Building2 } from 'lucide-react'

export function OrganizationForm() {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')

  const generateSlug = (nameValue: string) => {
    return nameValue
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
  }

  const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newName = e.target.value
    setName(newName)
    if (!slug || slug === generateSlug(name)) {
      setSlug(generateSlug(newName))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)

    try {
      const organization = await createOrganization({
        name: name.trim(),
        slug: slug.trim() || undefined,
      })

      toast({
        title: 'Organization created',
        description: `${organization.name} has been created successfully.`,
      })

      router.push(`/organizations/${organization.id}`)
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to create organization',
        variant: 'destructive',
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <Building2 className="h-5 w-5 text-primary" />
          <CardTitle>Organization Details</CardTitle>
        </div>
        <CardDescription>
          Enter the details for your new organization
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">Organization Name *</Label>
            <Input
              id="name"
              value={name}
              onChange={handleNameChange}
              placeholder="My Company"
              required
              disabled={isLoading}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="slug">Slug</Label>
            <Input
              id="slug"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="my-company"
              disabled={isLoading}
            />
            <p className="text-xs text-muted-foreground">
              URL-friendly identifier (auto-generated from name if left empty)
            </p>
          </div>
          <div className="flex gap-2 pt-4">
            <Button type="submit" disabled={isLoading || !name.trim()}>
              {isLoading ? 'Creating...' : 'Create Organization'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              disabled={isLoading}
            >
              Cancel
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  )
}
