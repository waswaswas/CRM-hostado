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

  // Verify user is owner first
  const { data: org } = await supabase
    .from('organizations')
    .select('owner_id')
    .eq('id', id)
    .single()

  if (!org || org.owner_id !== user.id) {
    throw new Error('Only the owner can delete an organization')
  }

  // Try using the database function first (if it exists)
  // This function uses SECURITY DEFINER to bypass RLS and safely delete the org
  try {
    const { error: funcError, data: funcData } = await supabase.rpc('delete_organization_safe', {
      org_id: id,
      requesting_user_id: user.id,
    })

    if (!funcError) {
      // Function exists and succeeded
      // Clear cookie if it was current organization
      const currentOrgId = await getCurrentOrganizationId()
      if (currentOrgId === id) {
        const cookieStore = await cookies()
        cookieStore.delete(COOKIE_NAME)
      }
      revalidatePath('/organizations')
      return
    }

    // Check if function doesn't exist (42883 error code)
    const funcNotFound = 
      funcError.code === '42883' || 
      funcError.code === 'P0001' ||
      funcError.message?.includes('function') || 
      funcError.message?.includes('does not exist') ||
      funcError.message?.includes('Could not find the function')

    if (funcNotFound) {
      // Function doesn't exist, fall through to direct deletion
      console.log('Database function not found, using direct deletion')
    } else {
      // Function exists but returned an error - throw it with full details
      console.error('Error from delete_organization_safe function:', funcError)
      throw new Error(funcError.message || `Failed to delete organization: ${funcError.code || 'Unknown error'}`)
    }
  } catch (rpcError: any) {
    // If RPC call itself fails (not just the function), check if function exists
    if (rpcError?.code === '42883' || rpcError?.message?.includes('does not exist')) {
      console.log('Database function not found, using direct deletion')
      // Fall through to direct deletion
    } else {
      // Re-throw other errors
      throw rpcError
    }
  }

  // Fallback: Direct deletion (may fail due to RLS, but try anyway)
  // Delete related records first (before organization deletion)
  
  // 1. Delete organization permissions
  await supabase
    .from('organization_permissions')
    .delete()
    .eq('organization_id', id)

  // 2. Delete organization invitations
  await supabase
    .from('organization_invitations')
    .delete()
    .eq('organization_id', id)

  // 3. Delete organization members
  // Note: This might fail if RLS prevents deleting owner members
  // In that case, the database function above should be used
  const { error: membersError } = await supabase
    .from('organization_members')
    .delete()
    .eq('organization_id', id)

  if (membersError) {
    // If deleting members fails (especially due to owner restriction),
    // we cannot proceed - the function should have handled this
    throw new Error(
      `Cannot delete organization: ${membersError.message}. ` +
      `The database function 'delete_organization_safe' should be used instead. ` +
      `Please ensure it exists and is properly configured.`
    )
  }

  // 4. Finally, delete the organization itself
  const { error } = await supabase
    .from('organizations')
    .delete()
    .eq('id', id)

  if (error) {
    throw new Error(
      `Failed to delete organization: ${error.message}. ` +
      `Please ensure the database function 'delete_organization_safe' exists and is properly configured.`
    )
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

export async function generateInvitationCode(organizationId: string): Promise<{
  code: string
  expires_at: string
}> {
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
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    throw new Error('Insufficient permissions')
  }

  // Generate a unique 8-character alphanumeric code
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789' // Exclude confusing chars
  let code = ''
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length))
  }

  // Set expiration to 45 minutes from now
  const expiresAt = new Date()
  expiresAt.setMinutes(expiresAt.getMinutes() + 45)

  // Get current organization settings
  const { data: currentOrg } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', organizationId)
    .single()

  if (!currentOrg) {
    throw new Error('Organization not found')
  }

  // Store invitation code in settings
  const updatedSettings = {
    ...(currentOrg.settings || {}),
    invitation_code: code,
    invitation_code_expires_at: expiresAt.toISOString(),
    invitation_code_created_by: user.id,
  }

  const { error } = await supabase
    .from('organizations')
    .update({
      settings: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/organizations')
  revalidatePath(`/organizations/${organizationId}`)

  return {
    code,
    expires_at: expiresAt.toISOString(),
  }
}

export async function validateInvitationCode(code: string): Promise<{
  valid: boolean
  organizationId?: string
  organizationName?: string
  expiresAt?: string
  error?: string
}> {
  const supabase = await createClient()

  // Normalize code to uppercase for comparison
  const normalizedCode = code.toUpperCase().trim()

  if (!normalizedCode || normalizedCode.length !== 8) {
    return { valid: false, error: 'Invalid invitation code format. Code must be 8 characters.' }
  }

  try {
    // Get all active organizations - RLS policy should allow this for validation
    const { data: organizations, error } = await supabase
      .from('organizations')
      .select('id, name, settings')
      .eq('is_active', true)

    if (error) {
      console.error('Error fetching organizations for code validation:', error)
      
      // Check if it's an RLS/permission error
      const isPermissionError = 
        error.message.includes('permission') || 
        error.message.includes('policy') || 
        error.message.includes('row-level security') ||
        error.code === '42501' ||
        error.code === 'PGRST301'

      if (isPermissionError) {
        return {
          valid: false,
          error: 'Unable to validate code due to permissions. Please run the RLS policy fix script in Supabase SQL Editor.',
        }
      }
      
      return { valid: false, error: 'Failed to validate code. Please try again.' }
    }

    if (!organizations || organizations.length === 0) {
      return { valid: false, error: 'No active organizations found' }
    }

    // Search through all organizations for matching code
    for (const org of organizations) {
      const settings = org.settings as any

      if (!settings || !settings.invitation_code) {
        continue
      }

      const storedCode = String(settings.invitation_code).toUpperCase().trim()

      // Compare codes (case-insensitive)
      if (storedCode === normalizedCode) {
        const expiresAt = settings?.invitation_code_expires_at
        if (expiresAt) {
          const expirationDate = new Date(expiresAt)
          const now = new Date()
          if (expirationDate < now) {
            return { valid: false, error: 'Invitation code has expired' }
          }
        }
        return {
          valid: true,
          organizationId: org.id,
          organizationName: org.name,
          expiresAt,
        }
      }
    }

    return { valid: false, error: 'Invalid invitation code' }
  } catch (error) {
    console.error('Unexpected error validating invitation code:', error)
    return { 
      valid: false, 
      error: error instanceof Error ? error.message : 'Failed to validate code' 
    }
  }
}

export async function joinOrganizationByCode(code: string): Promise<Organization> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Not authenticated')
  }

  // Normalize code
  const normalizedCode = code.toUpperCase().trim()

  // Validate code first
  const validation = await validateInvitationCode(code)
  if (!validation.valid || !validation.organizationId) {
    throw new Error(validation.error || 'Invalid invitation code')
  }

  // Check if user is already a member
  const { data: existingMember } = await supabase
    .from('organization_members')
    .select('id')
    .eq('organization_id', validation.organizationId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (existingMember) {
    throw new Error('You are already a member of this organization')
  }

  // Add user as member with viewer role (default, can be changed by owner)
  const { data: member, error: memberError } = await supabase
    .from('organization_members')
    .insert({
      organization_id: validation.organizationId,
      user_id: user.id,
      role: 'viewer',
      joined_at: new Date().toISOString(),
      is_active: true,
    })
    .select()
    .single()

  if (memberError) {
    if (memberError.message.includes('row-level security') || memberError.message.includes('policy')) {
      throw new Error(
        'Unable to join organization due to security restrictions. Please check RLS policies.'
      )
    }
    throw new Error(memberError.message)
  }

  // Set default permissions - only dashboard access for new members
  const defaultPermissions = [
    { feature: 'dashboard', has_access: true },
    { feature: 'clients', has_access: false },
    { feature: 'offers', has_access: false },
    { feature: 'emails', has_access: false },
    { feature: 'accounting', has_access: false },
    { feature: 'reminders', has_access: false },
    { feature: 'settings', has_access: false },
    { feature: 'users', has_access: false },
  ]

  // Create permissions for each feature
  for (const perm of defaultPermissions) {
    // Check if permission already exists
    const { data: existing } = await supabase
      .from('organization_permissions')
      .select('id')
      .eq('organization_id', validation.organizationId)
      .eq('user_id', user.id)
      .eq('feature', perm.feature)
      .single()

    if (existing) {
      // Update existing
      const { error: permError } = await supabase
        .from('organization_permissions')
        .update({ has_access: perm.has_access })
        .eq('id', existing.id)

      if (permError) {
        console.error(`Error updating permission for ${perm.feature}:`, permError)
      }
    } else {
      // Insert new
      const { error: permError } = await supabase
        .from('organization_permissions')
        .insert({
          organization_id: validation.organizationId,
          user_id: user.id,
          feature: perm.feature,
          has_access: perm.has_access,
        })

      if (permError) {
        console.error(`Error creating permission for ${perm.feature}:`, permError)
      }
    }
  }

  // Get organization
  const { data: organization } = await supabase
    .from('organizations')
    .select('*')
    .eq('id', validation.organizationId)
    .single()

  if (!organization) {
    throw new Error('Organization not found')
  }

  // Set as current organization
  await setCurrentOrganizationId(validation.organizationId)

  revalidatePath('/organizations')
  revalidatePath('/dashboard')

  return organization
}

export async function updateOrganizationEmailSettings(
  organizationId: string,
  emailSettings: {
    from_email?: string
    from_name?: string
    smtp_host?: string
    smtp_port?: string
    smtp_user?: string
    smtp_password?: string
    smtp_secure?: boolean
  }
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
    .eq('organization_id', organizationId)
    .eq('user_id', user.id)
    .eq('is_active', true)
    .single()

  if (!member || (member.role !== 'owner' && member.role !== 'admin')) {
    throw new Error('Insufficient permissions')
  }

  // Get current organization settings
  const { data: currentOrg } = await supabase
    .from('organizations')
    .select('settings')
    .eq('id', organizationId)
    .single()

  if (!currentOrg) {
    throw new Error('Organization not found')
  }

  // Merge email settings into existing settings
  const updatedSettings = {
    ...(currentOrg.settings || {}),
    email: {
      ...((currentOrg.settings as any)?.email || {}),
      ...emailSettings,
    },
  }

  const { data: organization, error } = await supabase
    .from('organizations')
    .update({
      settings: updatedSettings,
      updated_at: new Date().toISOString(),
    })
    .eq('id', organizationId)
    .select()
    .single()

  if (error) {
    throw new Error(error.message)
  }

  revalidatePath('/organizations')
  revalidatePath(`/organizations/${organizationId}`)
  return organization
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

export async function getMemberPermissions(
  organizationId: string,
  userId: string
): Promise<Record<string, boolean>> {
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

  // Get target member's role
  const { data: targetMember } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .single()

  if (!targetMember) {
    throw new Error('Member not found')
  }

  // Owners and admins have all permissions
  if (targetMember.role === 'owner' || targetMember.role === 'admin') {
    return {
      dashboard: true,
      clients: true,
      offers: true,
      emails: true,
      accounting: true,
      reminders: true,
      settings: true,
      users: true,
    }
  }

  // Get permissions from organization_permissions table
  const { data: permissions } = await supabase
    .from('organization_permissions')
    .select('feature, has_access')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)

  const permMap: Record<string, boolean> = {
    dashboard: true, // Always accessible
    clients: false,
    offers: false,
    emails: false,
    accounting: false,
    reminders: false,
    settings: false,
    users: false,
  }

  permissions?.forEach((perm: any) => {
    permMap[perm.feature] = perm.has_access || false
  })

  return permMap
}

export async function updateMemberPermissions(
  organizationId: string,
  userId: string,
  permissions: Record<string, boolean>
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

  // Prevent modifying owner permissions
  const { data: targetMember } = await supabase
    .from('organization_members')
    .select('role')
    .eq('organization_id', organizationId)
    .eq('user_id', userId)
    .single()

  if (targetMember?.role === 'owner') {
    throw new Error('Cannot modify owner permissions')
  }

  // Update permissions for each feature
  for (const [feature, hasAccess] of Object.entries(permissions)) {
    // Check if permission exists
    const { data: existing } = await supabase
      .from('organization_permissions')
      .select('id')
      .eq('organization_id', organizationId)
      .eq('user_id', userId)
      .eq('feature', feature)
      .single()

    if (existing) {
      // Update existing
      const { error } = await supabase
        .from('organization_permissions')
        .update({ has_access: hasAccess })
        .eq('id', existing.id)

      if (error) {
        console.error(`Error updating permission for ${feature}:`, error)
        throw new Error(`Failed to update permission for ${feature}`)
      }
    } else {
      // Insert new
      const { error } = await supabase
        .from('organization_permissions')
        .insert({
          organization_id: organizationId,
          user_id: userId,
          feature: feature as any,
          has_access: hasAccess,
        })

      if (error) {
        console.error(`Error creating permission for ${feature}:`, error)
        throw new Error(`Failed to create permission for ${feature}`)
      }
    }
  }

  revalidatePath(`/organizations/${organizationId}`)
}

