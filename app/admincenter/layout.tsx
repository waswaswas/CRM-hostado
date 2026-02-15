import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Admin Center',
  description: 'Internal admin only',
  robots: {
    index: false,
    follow: false,
    noarchive: true,
    googleBot: { index: false, follow: false },
  },
}

export default function AdminCenterLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-muted/30">
      {children}
    </div>
  )
}
