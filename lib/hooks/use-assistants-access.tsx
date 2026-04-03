'use client'

import { useEffect, useState } from 'react'
import { useOrganization } from '@/lib/organization-context'
import {
  getAssistantsAccessState,
  type AssistantsAccessState,
} from '@/app/actions/ai-assistants'

export function useAssistantsAccess() {
  const { currentOrganization, isLoading: orgLoading } = useOrganization()
  const [state, setState] = useState<AssistantsAccessState | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function run() {
      if (!currentOrganization?.id || orgLoading) {
        if (!cancelled) {
          setState(null)
          setLoading(orgLoading)
        }
        return
      }
      setLoading(true)
      try {
        const s = await getAssistantsAccessState()
        if (!cancelled) setState(s)
      } catch {
        if (!cancelled)
          setState({
            canUseFeature: false,
            canManage: false,
            allowedBotIds: [],
            orgId: currentOrganization.id,
          })
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    run()
    return () => {
      cancelled = true
    }
  }, [currentOrganization?.id, orgLoading])

  return {
    loading: orgLoading || loading,
    canOpen: state?.canUseFeature === true,
    canManage: state?.canManage === true,
    allowedBotIds: state?.allowedBotIds ?? [],
  }
}
