import { NextRequest, NextResponse } from 'next/server'

/**
 * Redirects to the offer document view page.
 * - format=pdf: redirect to document page with print=1 (user can use browser Print → Save as PDF).
 * - format=png: redirect to document page (user can use screenshot or browser tools).
 * No server-side PDF/PNG generation to avoid extra dependencies; focus on app code.
 */
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ id: string }> }
) {
  const { id } = await context.params
  const { searchParams } = new URL(request.url)
  const format = searchParams.get('format')
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || request.nextUrl.origin
  const documentUrl = `${baseUrl}/offers/${id}/document`
  if (format === 'pdf') {
    return NextResponse.redirect(`${documentUrl}?print=1`)
  }
  return NextResponse.redirect(documentUrl)
}
