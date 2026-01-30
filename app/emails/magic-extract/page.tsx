import { AppLayout } from '@/components/layout/app-layout'
import { MagicExtractSettings } from '@/components/emails/magic-extract-settings'
import { getCurrentUserOrgRole } from '@/app/actions/organizations'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'

export default async function MagicExtractPage() {
  const role = await getCurrentUserOrgRole()
  if (role !== 'owner') {
    return (
      <AppLayout>
        <Card>
          <CardHeader>
            <CardTitle>Magic extract</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Only the organization owner can manage Magic extract rules.
            </p>
          </CardContent>
        </Card>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <MagicExtractSettings />
    </AppLayout>
  )
}
