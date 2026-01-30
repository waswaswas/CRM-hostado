import { AppLayout } from '@/components/layout/app-layout'
import { MagicExtractSettings } from '@/components/emails/magic-extract-settings'
import { getCurrentUserOrgRole } from '@/app/actions/organizations'
import { seedInitialInquiryRuleForHostado } from '@/app/actions/magic-extract'
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

  // Ensure Hostado org has the initial inquiry (contact form) rule so owners can see and manage it
  await seedInitialInquiryRuleForHostado()

  return (
    <AppLayout>
      <MagicExtractSettings />
    </AppLayout>
  )
}
