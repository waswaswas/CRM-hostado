import { AppLayout } from '@/components/layout/app-layout'

export default function TodoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <AppLayout>{children}</AppLayout>
}
