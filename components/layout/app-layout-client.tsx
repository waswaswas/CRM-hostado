'use client'

import { useEffect, useState } from 'react'
import { Sidebar } from './sidebar'
import { Topbar } from './topbar'
import { createClient } from '@/lib/supabase/client'

export function AppLayoutClient({ children }: { children: React.ReactNode }) {
  const [userEmail, setUserEmail] = useState<string | undefined>()

  useEffect(() => {
    async function getUser() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      setUserEmail(user?.email)
    }
    getUser()
  }, [])

  return (
    <div className="flex h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar userName={userEmail} />
        <main className="flex-1 overflow-y-auto bg-muted/50 p-6">
          {children}
        </main>
      </div>
    </div>
  )
}



