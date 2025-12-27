'use server'

import { createClient } from '@/lib/supabase/server'

export interface EmailAttachment {
  id: string
  email_id: string
  file_name: string
  file_path: string
  file_size: number
  mime_type: string
  created_at: string
}

export async function uploadEmailAttachment(
  emailId: string,
  formData: FormData
): Promise<EmailAttachment> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get file from FormData
  const file = formData.get('file') as File
  if (!file || !(file instanceof File)) {
    throw new Error('No file provided')
  }

  // Validate file type
  const allowedTypes = [
    'image/png',
    'image/jpeg',
    'image/jpg',
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'video/mp4',
    'video/quicktime',
    'video/x-msvideo',
    'video/webm',
  ]

  const fileExtension = file.name.split('.').pop()?.toLowerCase()
  const allowedExtensions = ['png', 'jpg', 'jpeg', 'pdf', 'doc', 'docx', 'mp4', 'mov', 'avi', 'webm']

  if (!allowedTypes.includes(file.type) && !allowedExtensions.includes(fileExtension || '')) {
    throw new Error(
      `File type not allowed. Allowed types: PNG, JPEG, PDF, Word documents, and videos.`
    )
  }

  // Validate file size (max 25MB)
  const maxSize = 25 * 1024 * 1024 // 25MB
  if (file.size > maxSize) {
    throw new Error('File size exceeds 25MB limit')
  }

  // Convert file to buffer
  const arrayBuffer = await file.arrayBuffer()
  const buffer = Buffer.from(arrayBuffer)

  // Generate unique file path
  const timestamp = Date.now()
  const sanitizedFileName = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
  const filePath = `emails/${emailId}/${timestamp}_${sanitizedFileName}`

  // Upload to Supabase Storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('email-attachments')
    .upload(filePath, buffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    throw new Error(`Failed to upload file: ${uploadError.message}`)
  }

  // Get public URL
  const {
    data: { publicUrl },
  } = supabase.storage.from('email-attachments').getPublicUrl(filePath)

  // Save attachment record to database
  const { data: attachment, error: dbError } = await supabase
    .from('email_attachments')
    .insert({
      email_id: emailId,
      file_name: file.name,
      file_path: filePath,
      file_size: file.size,
      mime_type: file.type,
    })
    .select()
    .single()

  if (dbError) {
    // If database insert fails, try to delete the uploaded file
    await supabase.storage.from('email-attachments').remove([filePath])
    throw new Error(`Failed to save attachment record: ${dbError.message}`)
  }

  return attachment as EmailAttachment
}

export async function getEmailAttachments(emailId: string): Promise<EmailAttachment[]> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Verify user owns the email
  const { data: email } = await supabase
    .from('emails')
    .select('owner_id')
    .eq('id', emailId)
    .eq('owner_id', user.id)
    .single()

  if (!email) {
    throw new Error('Email not found or unauthorized')
  }

  const { data, error } = await supabase
    .from('email_attachments')
    .select('*')
    .eq('email_id', emailId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new Error(`Failed to fetch attachments: ${error.message}`)
  }

  return (data || []) as EmailAttachment[]
}

export async function deleteEmailAttachment(attachmentId: string): Promise<void> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  // Get attachment to verify ownership and get file path
  const { data: attachment, error: fetchError } = await supabase
    .from('email_attachments')
    .select('*, emails!inner(owner_id)')
    .eq('id', attachmentId)
    .single()

  if (fetchError || !attachment) {
    throw new Error('Attachment not found')
  }

  // Verify user owns the email
  if ((attachment as any).emails.owner_id !== user.id) {
    throw new Error('Unauthorized')
  }

  // Delete from storage
  const { error: storageError } = await supabase.storage
    .from('email-attachments')
    .remove([attachment.file_path])

  if (storageError) {
    console.error('Failed to delete file from storage:', storageError)
    // Continue with database deletion even if storage deletion fails
  }

  // Delete from database
  const { error: dbError } = await supabase
    .from('email_attachments')
    .delete()
    .eq('id', attachmentId)

  if (dbError) {
    throw new Error(`Failed to delete attachment: ${dbError.message}`)
  }
}

export async function getAttachmentUrl(filePath: string): Promise<string> {
  const supabase = await createClient()
  const {
    data: { publicUrl },
  } = supabase.storage.from('email-attachments').getPublicUrl(filePath)
  return publicUrl
}






