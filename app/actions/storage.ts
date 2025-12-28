'use server'

import { createClient } from '@/lib/supabase/server'

/**
 * Generate a signed URL for a private file in Supabase Storage
 * @param filePath The path to the file in the storage bucket
 * @param expiresIn Expiration time in seconds (default: 3600 = 1 hour)
 * @returns Signed URL or null if error
 */
export async function getSignedUrl(
  filePath: string,
  expiresIn: number = 3600
): Promise<string | null> {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      throw new Error('Not authenticated')
    }

    // Extract bucket and path from filePath
    // Format: transaction-invoices/{userId}/{timestamp}.pdf
    const bucket = 'transaction-attachments'
    // The filePath should already be in the format: transaction-invoices/{userId}/{timestamp}.pdf
    const path = filePath

    const { data, error } = await supabase.storage
      .from(bucket)
      .createSignedUrl(path, expiresIn)

    if (error) {
      console.error('Error generating signed URL:', error)
      return null
    }

    return data.signedUrl
  } catch (error) {
    console.error('Error in getSignedUrl:', error)
    return null
  }
}


