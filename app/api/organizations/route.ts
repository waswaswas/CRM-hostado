import { NextResponse } from 'next/server'
import { getOrganizations, getCurrentOrganizationId, getOrganization, setCurrentOrganizationId } from '@/app/actions/organizations'

export async function GET() {
  try {
    const organizations = await getOrganizations()
    let currentOrgId = await getCurrentOrganizationId()
    
    // Auto-set first organization if none is set and organizations exist
    if (!currentOrgId && organizations && organizations.length > 0) {
      await setCurrentOrganizationId(organizations[0].id)
      currentOrgId = organizations[0].id
    }
    
    const currentOrganization = currentOrgId ? await getOrganization(currentOrgId) : null

    return NextResponse.json({
      organizations,
      currentOrganization,
    }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Error fetching organizations:', error)
    return NextResponse.json(
      { 
        error: 'Failed to fetch organizations',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    )
  }
}

