'use server'

import { createClient } from '@/lib/supabase/server'
import { renderTemplate, type TemplateVariables } from '@/lib/email-template-utils'

export type TemplateCategory = 'follow_up' | 'offer' | 'welcome' | 'custom'

export interface EmailTemplate {
  id: string
  created_at: string
  updated_at: string
  owner_id: string
  name: string
  category: TemplateCategory | null
  subject: string
  body_html: string
  body_text: string | null
  variables: string[]
  is_shared: boolean
}

export interface CreateTemplateInput {
  name: string
  category?: TemplateCategory
  subject: string
  body_html: string
  body_text?: string
  variables?: string[]
  is_shared?: boolean
}


export async function createTemplate(input: CreateTemplateInput): Promise<EmailTemplate> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('email_templates')
    .insert({
      owner_id: user.id,
      name: input.name,
      category: input.category || null,
      subject: input.subject,
      body_html: input.body_html,
      body_text: input.body_text,
      variables: input.variables || [],
      is_shared: input.is_shared || false,
    })
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to create template: ${error.message}`)
  }

  return data as EmailTemplate
}

export async function updateTemplate(
  templateId: string,
  updates: Partial<CreateTemplateInput>
): Promise<EmailTemplate> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('email_templates')
    .update(updates)
    .eq('id', templateId)
    .eq('owner_id', user.id)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to update template: ${error.message}`)
  }

  return data as EmailTemplate
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { error } = await supabase
    .from('email_templates')
    .delete()
    .eq('id', templateId)
    .eq('owner_id', user.id)

  if (error) {
    throw new Error(`Failed to delete template: ${error.message}`)
  }
}

export async function getTemplates(category?: TemplateCategory): Promise<EmailTemplate[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  let query = supabase
    .from('email_templates')
    .select('*')
    .or(`owner_id.eq.${user.id},is_shared.eq.true`)
    .order('created_at', { ascending: false })

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query

  if (error) {
    throw new Error(`Failed to fetch templates: ${error.message}`)
  }

  return (data || []) as EmailTemplate[]
}

export async function getTemplate(templateId: string): Promise<EmailTemplate> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const { data, error } = await supabase
    .from('email_templates')
    .select('*')
    .eq('id', templateId)
    .or(`owner_id.eq.${user.id},is_shared.eq.true`)
    .single()

  if (error) {
    throw new Error(`Failed to fetch template: ${error.message}`)
  }

  return data as EmailTemplate
}


