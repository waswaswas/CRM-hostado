import { NextRequest, NextResponse } from 'next/server'
import { processOfferEmailSequences } from '@/app/actions/offer-email-sequences'

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await processOfferEmailSequences()
    return NextResponse.json({
      message: 'Processed offer email sequences',
      ...result,
    })
  } catch (error) {
    console.error('Error in process-offer-sequences cron:', error)
    return NextResponse.json(
      {
        error: 'Internal server error',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}
