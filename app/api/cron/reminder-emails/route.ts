import { NextRequest, NextResponse } from 'next/server'
import { processReminderEmails } from '@/app/actions/reminder-emails'

/** Daily cron: send opt-in reminder emails at 3 and 7 days after due date. */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processReminderEmails()
    return NextResponse.json({
      message: 'Reminder emails processed',
      ...result,
    })
  } catch (error) {
    console.error('Error in reminder-emails cron:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
