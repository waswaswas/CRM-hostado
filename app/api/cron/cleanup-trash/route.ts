import { NextRequest, NextResponse } from 'next/server'
import { cleanupOldTrashEmails } from '@/app/actions/emails'

export async function GET(request: NextRequest) {
  // Verify the request is from a cron job or has proper authentication
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const deletedCount = await cleanupOldTrashEmails()
    return NextResponse.json({
      success: true,
      deletedCount,
      message: `Successfully deleted ${deletedCount} old emails from trash`,
    })
  } catch (error) {
    console.error('Failed to cleanup trash emails:', error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

