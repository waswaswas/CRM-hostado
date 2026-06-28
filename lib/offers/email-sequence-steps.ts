import type { Offer } from '@/types/database'

export interface OfferSequenceStep {
  step: number
  delayDays: number
  subject: string
  bodyHtml: string
  skipIf?: (offer: Offer) => boolean
}

export function getDefaultOfferSequenceSteps(): OfferSequenceStep[] {
  return [
    {
      step: 0,
      delayDays: 0,
      subject: 'Вашата оферта от Hostado',
      bodyHtml: `<p>Здравейте, {{client_name}},</p>
<p>Подготвихме оферта за Вас: <strong>{{offer_title}}</strong> на стойност <strong>{{offer_amount}} {{offer_currency}}</strong>.</p>
<p><a href="{{offer_link}}">Прегледайте и платете офертата тук</a></p>
<p>С уважение,<br>Екипът на Hostado</p>`,
    },
    {
      step: 1,
      delayDays: 2,
      subject: 'Напомняне: Вашата оферта от Hostado',
      bodyHtml: `<p>Здравейте, {{client_name}},</p>
<p>Напомняме Ви за офертата <strong>{{offer_title}}</strong> ({{offer_amount}} {{offer_currency}}).</p>
<p><a href="{{offer_link}}">Отворете офертата</a></p>`,
      skipIf: (offer) => (offer.opened_history?.length ?? 0) > 0,
    },
    {
      step: 2,
      delayDays: 5,
      subject: 'Офертата Ви очаква — Hostado',
      bodyHtml: `<p>Здравейте, {{client_name}},</p>
<p>Видяхме, че сте прегледали офертата <strong>{{offer_title}}</strong>. Ако имате въпроси, отговорете на този имейл.</p>
<p><a href="{{offer_link}}">Завършете плащането</a></p>`,
      skipIf: (offer) =>
        offer.status === 'paid' || offer.status === 'accepted' || offer.status === 'pending_payment',
    },
    {
      step: 3,
      delayDays: -1,
      subject: 'Офертата изтича утре — Hostado',
      bodyHtml: `<p>Здравейте, {{client_name}},</p>
<p>Офертата <strong>{{offer_title}}</strong> изтича на {{valid_until}}.</p>
<p><a href="{{offer_link}}">Платете сега</a></p>`,
      skipIf: (offer) => offer.status === 'paid' || offer.status === 'accepted',
    },
  ]
}

export function computeNextSendAt(
  publishedAt: string,
  step: OfferSequenceStep,
  offer: Offer
): string | null {
  if (step.delayDays === -1) {
    if (!offer.valid_until) return null
    const expiry = new Date(offer.valid_until)
    expiry.setDate(expiry.getDate() - 1)
    return expiry.toISOString()
  }
  const base = new Date(publishedAt)
  base.setDate(base.getDate() + step.delayDays)
  return base.toISOString()
}

export function buildOfferEmailVariables(offer: Offer, baseUrl: string): Record<string, string> {
  const link =
    offer.payment_token && offer.id
      ? `${baseUrl}/offers/${offer.id}/pay?token=${offer.payment_token}`
      : baseUrl
  return {
    client_name: offer.recipient_snapshot?.name || 'Клиент',
    client_email: offer.recipient_snapshot?.email || '',
    offer_title: offer.title,
    offer_amount: String(offer.amount),
    offer_currency: offer.currency,
    offer_link: link,
    valid_until: offer.valid_until
      ? new Date(offer.valid_until).toLocaleDateString('bg-BG')
      : '',
  }
}
