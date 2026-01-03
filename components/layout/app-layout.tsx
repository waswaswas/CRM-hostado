import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { BottomNav } from './bottom-nav'
import { FloatingActionButton } from '@/components/ui/floating-action-button'
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
    <div className="flex h-screen">
      <Sidebar userName={user?.email} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar userName={user?.email} />
        <main className="flex-1 overflow-y-auto bg-muted/50 p-4 md:p-6">
          {children}
        </main>
        <FloatingActionButton />
      </div>
    </div>
  )
}



