import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { sendEmail } from '@/lib/email-provider'
import { createInteraction } from '@/app/actions/interactions'

// This endpoint should be called by a cron job (e.g., cron-job.org, Vercel Cron)
// It processes scheduled emails and sends them
export async function GET(request: NextRequest) {
  // Optional: Add authentication token check
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()

    // Get all scheduled emails that are due
    const now = new Date().toISOString()
    const { data: scheduledEmails, error: fetchError } = await supabase
      .from('emails')
      .select('*')
      .eq('status', 'scheduled')
      .lte('scheduled_at', now)

    if (fetchError) {
      console.error('Error fetching scheduled emails:', fetchError)
      return NextResponse.json(
        { error: 'Failed to fetch scheduled emails', details: fetchError.message },
        { status: 500 }
      )
    }

    if (!scheduledEmails || scheduledEmails.length === 0) {
      return NextResponse.json({
        message: 'No scheduled emails to process',
        processed: 0,
      })
    }

    let successCount = 0
    let failureCount = 0

    // Process each scheduled email
    for (const email of scheduledEmails) {
      try {
        // Update status to sending
        await supabase
          .from('emails')
          .update({ status: 'sending' })
          .eq('id', email.id)

        // Send email
        const result = await sendEmail({
          to: email.to_email,
          toName: email.to_name || undefined,
          subject: email.subject,
          html: email.body_html,
          text: email.body_text || undefined,
          cc: email.cc_emails || undefined,
          bcc: email.bcc_emails || undefined,
        })

        if (result.success) {
          // Update email status to sent
          await supabase
            .from('emails')
            .update({
              status: 'sent',
              sent_at: new Date().toISOString(),
              provider_message_id: result.messageId,
              provider_response: result.response,
              error_message: null,
            })
            .eq('id', email.id)

          // Create interaction
          try {
            await createInteraction({
              client_id: email.client_id,
              type: 'email',
              direction: 'outbound',
              date: new Date().toISOString(),
              subject: email.subject,
              notes: email.body_text || email.body_html,
              email_id: email.id,
            })
          } catch (interactionError) {
            console.error('Failed to create interaction:', interactionError)
          }

          successCount++
        } else {
          // Update email status to failed
          await supabase
            .from('emails')
            .update({
              status: 'failed',
              error_message: result.error,
              retry_count: (email.retry_count || 0) + 1,
            })
            .eq('id', email.id)

          failureCount++
        }
      } catch (error) {
        console.error(`Error processing email ${email.id}:`, error)
        
        // Update email status to failed
        await supabase
          .from('emails')
          .update({
            status: 'failed',
            error_message: error instanceof Error ? error.message : 'Unknown error',
            retry_count: (email.retry_count || 0) + 1,
          })
          .eq('id', email.id)

        failureCount++
      }
    }

    return NextResponse.json({
      message: 'Processed scheduled emails',
      processed: scheduledEmails.length,
      success: successCount,
      failed: failureCount,
    })
  } catch (error) {
    console.error('Error in process-emails cron:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}








