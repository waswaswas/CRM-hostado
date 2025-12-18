'use server'

import { createClient } from '@/lib/supabase/server'

export interface EmailSignature {
  id: string
  created_at: string
  updated_at: string
  owner_id: string
  name: string
  is_default: boolean
  html_content: string
  text_content: string | null
  include_logo: boolean
  include_social_links: boolean
  social_links: any
}

export interface CreateSignatureInput {
  name: string
  html_content: string
  text_content?: string
  is_default?: boolean
  include_logo?: boolean
  include_social_links?: boolean
  social_links?: any
}

export async function createSignature(input: CreateSignatureInput): Promise<EmailSignature> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // If this is set as default, unset other defaults
  if (input.is_default) {
    await supabase
      .from('email_signatures')
      .update({ is_default: false })
      .eq('owner_id', user.id)
      .eq('is_default', true)
  }

  const { data, error } = await supabase
    .from('email_signatures')
    .insert({
      owner_id: user.id,
      name: input.name,
      html_content: input.html_content,
      text_content: input.text_content,
      is_default: input.is_default || false,
      include_logo: input.include_logo ?? true,
      include_social_links: input.include_social_links ?? false,
      social_links: input.social_links || {},
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create signature: ${error.message}`)
  }

  return data as EmailSignature
}

export async function updateSignature(
  signatureId: string,
  updates: Partial<CreateSignatureInput>
): Promise<EmailSignature> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // If setting as default, unset other defaults
  if (updates.is_default) {
    await supabase
      .from('email_signatures')
      .update({ is_default: false })
      .eq('owner_id', user.id)
      .eq('is_default', true)
      .neq('id', signatureId)
  }

  const { data, error } = await supabase
    .from('email_signatures')
    .update(updates)
    .eq('id', signatureId)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update signature: ${error.message}`)
  }

  return data as EmailSignature
}

export async function deleteSignature(signatureId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { error } = await supabase
    .from('email_signatures')
    .delete()
    .eq('id', signatureId)
    .eq('owner_id', user.id)

  if (error) {
    throw new Error(`Failed to delete signature: ${error.message}`)
  }
}

export async function getSignatures(): Promise<EmailSignature[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('email_signatures')
    .select('*')
    .eq('owner_id', user.id)
    .order('is_default', { ascending: false })
    .order('created_at', { ascending: false })

  if (error) {
    throw new Error(`Failed to fetch signatures: ${error.message}`)
  }

  return (data || []) as EmailSignature[]
}

export async function getSignature(signatureId: string): Promise<EmailSignature> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('email_signatures')
    .select('*')
    .eq('id', signatureId)
    .eq('owner_id', user.id)
    .single()

  if (error) {
    throw new Error(`Failed to fetch signature: ${error.message}`)
  }

  return data as EmailSignature
}
