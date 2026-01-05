import { NextResponse } from 'next/server'
import { getOrganizations, getCurrentOrganizationId, getOrganization } from '@/app/actions/organizations'

export async function GET() {
  try {
    const organizations = await getOrganizations()
    const currentOrgId = await getCurrentOrganizationId()
    const currentOrganization = currentOrgId ? await getOrganization(currentOrgId) : null

    return NextResponse.json({
      organizations,
      currentOrganization,
    })
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch organizations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}
