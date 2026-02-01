import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * Cron: unpublish offers that have passed their unpublish_after_days since published_at.
 * Call with: GET /api/cron/unpublish-offers (and optionally Authorization: Bearer CRON_SECRET).
 * For production, run this with a scheduler (e.g. Vercel Cron, or external cron with CRON_SECRET).
 * Note: With default createClient() (no user in cron context) the select may return no rows due to RLS.
 * To run across all orgs, use a Supabase service role client or a DB cron job.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const supabase = await createClient()
    const now = new Date()

    // Select offers that have metadata with is_published = true and published_at set.
    // PostgREST: we cannot filter by computed (published_at + days) in one query, so fetch candidates and filter in app.
    const { data: rows, error: fetchError } = await supabase
      .from('offers')
      .select('id, metadata')

    if (fetchError) {
      console.error('unpublish-offers fetch error:', fetchError)
      return NextResponse.json({ error: fetchError.message }, { status: 500 })
    }

    const toUnpublish: string[] = []
    for (const row of rows || []) {
      const meta = (row.metadata as Record<string, unknown>) || {}
      if (meta.is_published !== true || !meta.published_at) continue
      const publishedAt = new Date(meta.published_at as string)
      const days = Number(meta.unpublish_after_days ?? 14)
      const unpublishAt = new Date(publishedAt)
      unpublishAt.setDate(unpublishAt.getDate() + days)
      if (unpublishAt <= now) {
        toUnpublish.push(row.id)
      }
    }

    let updated = 0
    for (const id of toUnpublish) {
      const { data: offer, error: getErr } = await supabase
        .from('offers')
        .select('metadata')
        .eq('id', id)
        .single()
      if (getErr || !offer) continue
      const meta = (offer.metadata as Record<string, unknown>) || {}
      const nextMeta = { ...meta, is_published: false }
      const { error: updateErr } = await supabase
        .from('offers')
        .update({ metadata: nextMeta })
        .eq('id', id)
      if (!updateErr) updated++
    }

    return NextResponse.json({
      message: 'Unpublish check completed',
      candidates: toUnpublish.length,
      updated,
    })
  } catch (err) {
    console.error('unpublish-offers error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 }
    )
  }
}
