import { LayoutShell } from './layout-shell'
import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export async function AppLayout({ children }: { children: React.ReactNode }) {
  let user = null
  try {
    const supabase = await createClient()
    const {
      data: { user: authUser },
    } = await supabase.auth.getUser()
    user = authUser
  } catch (error) {
    // If Supabase is not configured, redirect to setup
    if (error instanceof Error && error.message.includes('Supabase is not configured')) {
      redirect('/setup')
    }
    // For other errors, still try to render but without user
    console.error('Error in AppLayout:', error)
  }

  return (
    <LayoutShell userName={user?.email}>
      {children}
    </LayoutShell>
  )
}



