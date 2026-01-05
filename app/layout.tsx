import type { Metadata } from 'next'
import { Inter } from 'next/font/google'
import './globals.css'
import { ToasterProvider } from '@/components/ui/toaster'
import { ThemeProvider } from '@/components/theme-provider'
import { OrganizationProvider } from '@/lib/organization-context'

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Pre-Sales CRM',
  description: 'Simple, intuitive pre-sales CRM platform',
  robots: {
    index: false,
    follow: false,
    nocache: true,
    googleBot: {
      index: false,
      follow: false,
      noimageindex: true,
    },
  },
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <ThemeProvider defaultTheme="system" storageKey="crm-theme">
          <ToasterProvider>
            <OrganizationProvider>
              {children}
            </OrganizationProvider>
          </ToasterProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}



