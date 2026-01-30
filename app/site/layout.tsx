import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Hostado GMS – Pre-Sales CRM',
  description: 'Pre-sales CRM for teams: clients, reminders, offers, emails, accounting, and to-do lists in one place.',
}

export default function SiteLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
