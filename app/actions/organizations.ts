'use server'

import { createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'
import { cookies } from 'next/headers'
import type { Organization, OrganizationMember } from '@/types/database'

const COOKIE_NAME = 'current_organization_id'
const COOKIE_MAX_AGE = 60 * 60 * 24 * 365 // 1 year

export async function getCurrentOrganizationId(): Promise<string | null> {
  const cookieStore = await cookies()
  const orgId = cookieStore.get(COOKIE_NAME)?.value
  return orgId || null
}

export async function setCurrentOrganizationId(organizationId: string) {
  const cookieStore = await cookies()
  cookieStore.set(COOKIE_NAME, organizationId, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: COOKIE_MAX_AGE,
    path: '/',
  })
  revalidatePath('/', 'layout')
}

export async function createOrganization(data: {
  name: string
  slug?: string
}): Promise<Organization> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  let slug = data.slug

  // Generate slug if not provided
  if (!slug) {
    slug = data.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
    
    // Check if slug exists and append number if needed
    let finalSlug = slug
    let counter = 0
    while (true) {
      const { data: existing } = await supabase
        .from('organizations')
        .select('id')
        .eq('slug', finalSlug)
        .single()
      
      if (!existing) break
      counter++
      finalSlug = `${slug}-${counter}`
    }
    slug = finalSlug
  }

  const { data: organization, error } = await supabase
    .from('organizations')
    .insert({
      name: data.name,
      slug,
      owner_id: user.id,
      is_active: true,
    })
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  // Trigger automatically creates owner membership
  // Set as current organization
  await setCurrentOrganizationId(organization.id)

  revalidatePath('/organizations')
  return organization
}

export async function getOrganizations(): Promise<Organization[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return []
  }

  // Try using the RPC function first
  const { data: orgs, error: rpcError } = await supabase.rpc('get_user_organizations', {
    user_uuid: user.id,
  })

  if (!rpcError && orgs) {
    return orgs as Organization[]
  }

  // Fallback to direct query
  const { data, error } = await supabase
    .from('organization_members')
    .select('organization:organizations(*)')
    .eq('user_id', user.id)
    .eq('is_active', true)

  if (error) {
    console.error('Error fetching organizations:', error)
    return []
  }

  const organizations = (data || [])
    .map((item: any) => item.organization)
    .filter((org: any) => org && org.is_active) as Organization[]

  return organizations.sort((a, b) => a.name.localeCompare(b.name))
}

export async function getOrganization(id: string): Promise<Organization | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  // Verify user is member
  const { data: member } = await supabase
    .from('organization_members')
    .select('organization_id')
    .eq('organization_id', id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) {
    return null
  }

  const { data: organization, error } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !organization) {
    return null
  }

  return organization
}

export async function updateOrganization(
  id: string,
  data: Partial<Pick<Organization, 'name' | 'settings'>>
): Promise<Organization> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Check user is owner/admin
  const { data: member } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', id)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    throw new Error('Insufficient permissions')
  }

  const { data: organization, error } = await supabase
    .from('organizations')
    .update(data)
    .eq('id', id)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/organizations')
  revalidatePath(`/organizations/${id}`)
  return organization
}

export async function deleteOrganization(id: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Verify user is owner
  const { data: org } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', id)
    .single()

  if (!org || org.owner_id !== user.id) {
    throw new Error('Only the owner can delete an organization')
  }

  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(error.message)
  }

  // Clear cookie if it was current organization
  const currentOrgId = await getCurrentOrganizationId()
  if (currentOrgId === id) {
    const cookieStore = await cookies()
    cookieStore.delete(COOKIE_NAME)
  }

  revalidatePath('/organizations')
}

export async function getOrganizationMembers(
  organizationId: string
): Promise<OrganizationMember[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Verify user is member
  const { data: member } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) {
    throw new Error('Not a member of this organization')
  }

  const { data, error } = await supabase
    .from('organization_members')
    .select('*')
    .eq('organization_id', organizationId)
    .eq('is_active', true)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(error.message)
  }

  // Try to get user emails from user_profiles if available
  const userIds = (data || []).map((m: any) => m.user_id)
  const userEmailsMap = new Map<string, string>()
  
  if (userIds.length > 0) {
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email')
      .in('id', userIds)
    
    profiles?.forEach((profile: any) => {
      userEmailsMap.set(profile.id, profile.email)
    })
  }

  return (data || []).map((item: any) => ({
    ...item,
    user_email: userEmailsMap.get(item.user_id) || undefined,
  })) as OrganizationMember[]
}

export async function updateMemberRole(
  organizationId: string,
  userId: string,
  role: 'admin' | 'moderator' | 'viewer'
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Check requester is owner/admin
  const { data: requesterMember } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!requesterMember || (requesterMember.role !== 'owner' && requesterMember.role !== 'admin')) {
    throw new Error('Insufficient permissions')
  }

  // Prevent changing owner role
  const { data: targetMember } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .single()

  if (targetMember?.role === 'owner') {
    throw new Error('Cannot change owner role')
  }

  const { error } = await supabase
    .from('organization_members')
    .update({ role })
    .eq('organization_id', organizationId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/organizations/${organizationId}`)
}

export async function removeMember(
  organizationId: string,
  userId: string
): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Check requester is owner/admin
  const { data: requesterMember } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!requesterMember || (requesterMember.role !== 'owner' && requesterMember.role !== 'admin')) {
    throw new Error('Insufficient permissions')
  }

  // Prevent removing owner
  const { data: targetMember } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .single()

  if (targetMember?.role === 'owner') {
    throw new Error('Cannot remove owner')
  }

  // Soft delete
  const { error } = await supabase
    .from('organization_members')
    .update({ is_active: false })
    .eq('organization_id', organizationId)
    .eq('user_id', userId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath(`/organizations/${organizationId}`)
}

export async function leaveOrganization(organizationId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Prevent owner from leaving
  const { data: member } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .single()

  if (member?.role === 'owner') {
    throw new Error('Owner cannot leave organization')
  }

  // Soft delete
  const { error } = await supabase
    .from('organization_members')
    .update({ is_active: false })
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)

  if (error) {
    throw new Error(error.message)
  }

  // Clear cookie if it was current organization
  const currentOrgId = await getCurrentOrganizationId()
  if (currentOrgId === organizationId) {
    const cookieStore = await cookies()
    cookieStore.delete(COOKIE_NAME)
  }

  revalidatePath('/organizations')
}

export async function getUserRole(
  organizationId: string
): Promise<'owner' | 'admin' | 'moderator' | 'viewer' | null> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return null
  }

  const { data: member } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  return (member?.role as any) || null
}

export async function hasFeaturePermission(
  organizationId: string,
  feature: string
): Promise<boolean> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return false
  }

  // Get user's role
  const { data: member } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member) {
    return false
  }

  // Owners and admins have all permissions
  if (member.role === 'owner' || member.role === 'admin') {
    return true
  }

  // Check specific permission
  const { data: permission } = await supabase
    .from('organization_permissions')
    .select('has_access')
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('feature', feature)
    .single()

  return permission?.has_access || false
}
