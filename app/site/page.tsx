import { createClient } from '@/lib/supabase/server'
import { SitePageClient } from './site-page-client'

export default async function SitePage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  return <SitePageClient isAuthenticated={!!user} />
}
