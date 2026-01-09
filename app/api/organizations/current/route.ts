import { NextResponse } from 'next/server'
import { getCurrentOrganizationId, setCurrentOrganizationId, getOrganization } from '@/app/actions/organizations'

export async function GET() {
  try {
    const currentOrgId = await getCurrentOrganizationId()
    const organization = currentOrgId ? await getOrganization(currentOrgId) : null
    return NextResponse.json({ organization }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Error fetching current organization:', error)
    return NextResponse.json(
      { error: 'Failed to fetch current organization' },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    )
  }
}

export async function POST(request: Request) {
  try {
    const { organizationId } = await request.json()
    
    if (!organizationId) {
      return NextResponse.json(
        { error: 'organizationId is required' },
        { 
          status: 400,
          headers: {
            'Cache-Control': 'no-cache, no-store, must-revalidate',
          },
        }
      )
    }

    await setCurrentOrganizationId(organizationId)
    const organization = await getOrganization(organizationId)
    
    return NextResponse.json({ organization }, {
      headers: {
        'Cache-Control': 'no-cache, no-store, must-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
      },
    })
  } catch (error) {
    console.error('Error setting current organization:', error)
    return NextResponse.json(
      { error: 'Failed to set current organization' },
      { 
        status: 500,
        headers: {
          'Cache-Control': 'no-cache, no-store, must-revalidate',
        },
      }
    )
  }
}

