import { redirect } from 'next/navigation'
import { userHasOrganizations } from '@/lib/organization-guard'

export default async function HomePage() {
  const hasOrgs = await userHasOrganizations()
  
  if (hasOrgs) {
    redirect('/dashboard')
  } else {
    redirect('/join-organization')
  }
}



