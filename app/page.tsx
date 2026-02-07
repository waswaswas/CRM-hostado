import { redirect } from 'next/navigation'
import { userHasOrganizations } from '@/lib/organization-guard'
import { createClient } from '@/lib/supabase/server'

export default async function HomePage() {
  try {
    const supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()

    if (!user) {
      redirect('/login')
    }

    const hasOrgs = await userHasOrganizations()
    if (hasOrgs) {
      redirect('/dashboard')
    } else {
      redirect('/join-organization')
    }
  } catch (error) {
    // Supabase not configured or other error - redirect to login
    redirect('/login')
  }
}



