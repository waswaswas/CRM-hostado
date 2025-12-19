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

export async function createDefaultHostadoSignature(): Promise<EmailSignature> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Check if Krasimir signature already exists
  const { data: existing } = await supabase
    .from('email_signatures')
    .select('*')
    .eq('owner_id', user.id)
    .eq('name', 'Krasimir')
    .maybeSingle()

  if (existing) {
    // If exists but not default, make it default
    if (!existing.is_default) {
      // Unset other defaults first
      await supabase
        .from('email_signatures')
        .update({ is_default: false })
        .eq('owner_id', user.id)
        .eq('is_default', true)
      
      const { data: updated } = await supabase
        .from('email_signatures')
        .update({ is_default: true })
        .eq('id', existing.id)
        .select()
        .single()
      
      if (updated) {
        return updated as EmailSignature
      }
    }
    return existing as EmailSignature
  }

  const hostadoSignatureHtml = `<!DOCTYPE HTML PUBLIC "-//W3C//DTD HTML 4.0 Transitional//EN">
<HTML>
<HEAD>
    <TITLE></TITLE>
    <META content="text/html; charset=utf-8" http-equiv="Content-Type">
</HEAD>
<BODY style="font-size: 10pt; font-family: Arial, sans-serif;">
    <table style="width: 420px; font-size: 10pt; font-family: Arial, sans-serif; background: transparent !important;"
        cellpadding="0" cellspacing="0" border="0">
        <tbody>
            <tr>
                <td style="font-size: 12pt; font-family: Arial, sans-serif; width:200px; padding-right: 10px; vertical-align: bottom;  padding-bottom: 10px;"
                    valign="bottom">
                    <p style="margin:0 0 15px 0; padding-bottom: 0px; line-height:1.0"><strong><span
                                style="font-size: 12pt; font-family: Arial, sans-serif; color:#1297f0; line-height: 18pt;">Красимир Дачев</span></strong><span
                            style="font-family: Arial, sans-serif; font-size:9pt; color:#010100;  line-height: 14pt;"><br>Акаунт Мениджър</span></p><span><a href="https://hostado.net/" target="_blank"><img
                                border="0" width="132" style="width:132px; height:auto; border:0;"
                                src="https://hostado.net/wp-content/uploads/2024/08/official.png"></a></span>
                </td>
                <td valign="top" style="vertical-align: top; padding-left: 30px; padding-bottom: 6px;"><span><span
                            style="color: #010100;"><strong>Имейл адрес:</strong></span><a href="mailto:support@hostado.net"
                            style="text-decoration: none; font-size: 9pt; font-family: Arial, sans-serif; color:#010100;"><span
                                style="text-decoration: none; font-size: 9pt; font-family: Arial, sans-serif; color:#010100;"> support@hostado.net</span></a><br></span><span><span
                            style="color: #010100;"><strong>Телефон за връзка:</strong></span><span
                            style="font-size: 9pt; font-family: Arial, sans-serif; color:#010100;"><br> +359 878 521
                            338<br></span></span> </td>
            </tr>
            <tr>
                <td style="vertical-align: top;border-top: 1px solid #1297f0; padding-top: 15px;" valign="top"><a
                        href="http://www.hostado.net" target="_blank" rel="noopener"
                        style="font-size: 9pt; font-family: Arial, sans-serif; text-decoration:none; color: #1297f0; font-weight: bold;"><span
                            style="font-size: 9pt; font-family: Arial, sans-serif; text-decoration:none; color: #1297f0; font-weight: bold;">www.hostado.net</span></a>
                </td>
                <td valign="top" align="right"
                    style="padding-left: 30px;border-top: 1px solid #1297f0; padding-top: 15px; text-align:right">
                    <table cellpadding="0" cellspacing="0" border="0"
                        style="float: right; background: transparent !important;">
                        <tbody>
                            <tr>
                                
                            </tr>
                        </tbody>
                    </table>
                </td>
            </tr>
        </tbody>
    </table>
</BODY>
</HTML>`

  const hostadoSignatureText = `Красимир Дачев
Акаунт Мениджър
Имейл адрес: support@hostado.net
Телефон за връзка: +359 878 521 338
www.hostado.net`

  // Unset any existing defaults
  await supabase
    .from('email_signatures')
    .update({ is_default: false })
    .eq('owner_id', user.id)
    .eq('is_default', true)

  const { data, error } = await supabase
    .from('email_signatures')
    .insert({
      owner_id: user.id,
      name: 'Krasimir',
      html_content: hostadoSignatureHtml,
      text_content: hostadoSignatureText,
      is_default: true,
      include_logo: true,
      include_social_links: false,
      social_links: {},
    })
    .select()
    .single()

  if (error) {
    // Check if it's a table missing error
    if (error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('table')) {
      throw new Error('Email signatures table does not exist. Please run supabase/SETUP_EMAILS.sql in your Supabase SQL Editor.')
    }
    throw new Error(`Failed to create default signature: ${error.message}`)
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
    // Check if table doesn't exist
    if (error.message.includes('relation') || error.message.includes('does not exist') || error.message.includes('table')) {
      throw new Error('Email signatures table does not exist. Please run supabase/SETUP_EMAILS.sql in your Supabase SQL Editor.')
    }
    throw new Error(`Failed to fetch signatures: ${error.message}`)
  }

  // If no signatures exist, create default Hostado signature
  if (!data || data.length === 0) {
    try {
      const defaultSig = await createDefaultHostadoSignature()
      // Return the newly created signature
      return [defaultSig]
    } catch (createError) {
      // If creation fails, try to fetch again in case it was created by another process
      const { data: retryData, error: retryError } = await supabase
        .from('email_signatures')
        .select('*')
        .eq('owner_id', user.id)
        .order('is_default', { ascending: false })
        .order('created_at', { ascending: false })

      if (retryError) {
        console.error('Failed to fetch signatures after creation attempt:', retryError)
        // Re-throw the original creation error if it's about missing table
        if (createError instanceof Error && (createError.message.includes('table') || createError.message.includes('relation'))) {
          throw createError
        }
        return []
      }

      // If we got data, return it; otherwise return empty array
      if (retryData && retryData.length > 0) {
        return (retryData || []) as EmailSignature[]
      }
      
      // If still no data, return empty array (user can create manually)
      return []
    }
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


