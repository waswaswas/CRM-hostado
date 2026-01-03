import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/app/actions/notifications'
import { getSettings } from '@/app/actions/settings'
import { subDays, isAfter } from 'date-fns'

// This cron job checks for clients that have lost their "New" tag
// and creates notifications for them
export async function GET(request: NextRequest) {
  // Verify cron secret if needed
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
    }

    // Get user settings for new_tag_days
    const settings = await getSettings()
    const newTagDays = settings.new_tag_days || 14

    // Get all presales clients
    const { data: clients, error: clientsError } = await supabase
      .from('clients')
      .select('id, name, created_at, client_type')
      .eq('owner_id', user.id)
      .eq('client_type', 'presales')

    if (clientsError) {
      throw new Error(clientsError.message)
    }

    if (!clients || clients.length === 0) {
      return NextResponse.json({ message: 'No clients to check', processed: 0 })
    }

    const now = new Date()
    const cutoffDate = subDays(now, newTagDays)
    let processed = 0

    // Check each client to see if they just lost their "New" tag
    // A client loses the "New" tag when: created_at is exactly newTagDays ago (or more)
    for (const client of clients) {
      const createdDate = new Date(client.created_at)
      const daysSinceCreation = Math.floor((now.getTime() - createdDate.getTime()) / (1000 * 60 * 60 * 24))
      
      // Check if the tag was removed today (within the last 24 hours)
      // Tag is removed when daysSinceCreation >= newTagDays
      const tagJustRemoved = daysSinceCreation >= newTagDays && daysSinceCreation < newTagDays + 1

      if (tagJustRemoved) {
        // Check if notification already exists for this client and tag removal (within last 7 days)
        const { data: existingNotification } = await supabase
          .from('notifications')
          .select('id')
          .eq('owner_id', user.id)
          .eq('type', 'tag_removed')
          .eq('related_id', client.id)
          .eq('related_type', 'client')
          .gte('created_at', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString())
          .single()

        if (!existingNotification) {
          // Create notification for tag removal
          await createNotification({
            type: 'tag_removed',
            title: '"New" tag removed',
            message: `The "New" tag has been automatically removed from ${client.name}`,
            related_id: client.id,
            related_type: 'client',
            metadata: {
              client_name: client.name,
              removed_at: now.toISOString(),
            },
          })
          processed++
        }
      }
    }

    return NextResponse.json({ 
      message: 'Tag removal check completed', 
      processed,
      checked: clients.length 
    })
  } catch (error) {
    console.error('Error checking tag removals:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}






