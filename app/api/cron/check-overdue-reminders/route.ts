import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createNotification } from '@/app/actions/notifications'

// This cron job checks for overdue reminders and creates notifications
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

    const now = new Date().toISOString()

    // Get user's clients
    const { data: clients } = await supabase
      .from('clients')
      .select('id')
      .eq('owner_id', user.id)

    if (!clients || clients.length === 0) {
      return NextResponse.json({ message: 'No clients found', processed: 0 })
    }

    const clientIds = clients.map((c) => c.id)

    // Get overdue reminders for user's clients
    const { data: overdueReminders } = await supabase
      .from('reminders')
      .select('*')
      .in('client_id', clientIds)
      .eq('done', false)
      .lt('due_at', now)

    // Get general overdue reminders
    const { data: generalOverdue } = await supabase
      .from('reminders')
      .select('*')
      .is('client_id', null)
      .eq('done', false)
      .lt('due_at', now)

    const allOverdue = [...(overdueReminders || []), ...(generalOverdue || [])]
    let processed = 0

    // Get client names for display
    const { data: allClients } = await supabase
      .from('clients')
      .select('id, name')
      .in('id', clientIds)

    const clientsMap = new Map(allClients?.map(c => [c.id, c]) || [])

    for (const reminder of allOverdue) {
      // Check if notification already exists for this overdue reminder (within last 24 hours)
      const { data: existingNotification } = await supabase
        .from('notifications')
        .select('id')
        .eq('owner_id', user.id)
        .eq('type', 'reminder')
        .eq('related_id', reminder.id)
        .eq('related_type', 'reminder')
        .gte('created_at', new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString())
        .single()

      if (!existingNotification) {
        // Create notification for overdue reminder
        const clientName = reminder.client_id 
          ? (clientsMap.get(reminder.client_id)?.name || 'Client')
          : 'General'
        
        await createNotification({
          type: 'reminder',
          title: 'Overdue reminder',
          message: `Reminder "${reminder.title}" for ${clientName} is overdue`,
          related_id: reminder.id,
          related_type: 'reminder',
          metadata: {
            due_at: reminder.due_at,
            client_id: reminder.client_id,
            is_overdue: true,
          },
        })
        processed++
      }
    }

    return NextResponse.json({ 
      message: 'Overdue reminders check completed', 
      processed 
    })
  } catch (error) {
    console.error('Error checking overdue reminders:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}


