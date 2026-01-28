'use client'

import { useEffect, useState } from 'react'
import { LayoutShell } from './layout-shell'
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

  return <LayoutShell userName={userEmail}>{children}</LayoutShell>
}



