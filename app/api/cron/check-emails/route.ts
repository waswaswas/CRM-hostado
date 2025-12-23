import { NextRequest, NextResponse } from 'next/server'
import { checkForNewEmails } from '@/lib/email-receiver'

export async function GET(request: NextRequest) {
  // Verify the request is authorized (using CRON_SECRET)
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 })
  }

  if (authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await checkForNewEmails()

    return NextResponse.json({
      success: result.success,
      processed: result.processed,
      errors: result.errors,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Error checking emails:', error)
    return NextResponse.json(
      {
        error: 'Failed to check emails',
        message: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
