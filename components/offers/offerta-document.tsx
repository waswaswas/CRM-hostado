'use client'

import type { Offer } from '@/types/database'
import { format } from 'date-fns'

interface OffertaDocumentProps {
  offer: Offer
  /** Company/sender name for header */
  senderName?: string
}

/** Renders the offer as "Оферта" (Bulgarian offer document) for view/print. */
export function OffertaDocument({ offer, senderName = 'Hostado' }: OffertaDocumentProps) {
  const lineItems = offer.line_items?.length ? offer.line_items : []
  const total = lineItems.length
    ? lineItems.reduce((s, i) => s + i.quantity * i.unit_price, 0)
    : offer.amount
  const r = offer.recipient_snapshot

  return (
    <div className="bg-white text-black p-8 max-w-[210mm] mx-auto print:p-6" style={{ fontFamily: 'system-ui, sans-serif' }}>
      <header className="border-b border-gray-300 pb-4 mb-6">
        <h1 className="text-2xl font-bold">ОФЕРТА</h1>
        <p className="text-sm text-gray-600 mt-1">{senderName}</p>
      </header>

      <div className="grid grid-cols-2 gap-4 mb-6 text-sm">
        <div>
          <p className="font-medium text-gray-700 mb-1">Дата</p>
          <p>{format(new Date(offer.created_at), 'dd.MM.yyyy')}</p>
        </div>
        <div>
          <p className="font-medium text-gray-700 mb-1">Валидна до</p>
          <p>{offer.valid_until ? format(new Date(offer.valid_until), 'dd.MM.yyyy') : '—'}</p>
        </div>
      </div>

      {r && (r.name || r.company) && (
        <section className="mb-6">
          <h2 className="text-sm font-bold text-gray-700 mb-2">Получател</h2>
          <div className="text-sm space-y-0.5">
            {r.name && <p><strong>Име:</strong> {r.name}</p>}
            {r.company && <p><strong>Фирма:</strong> {r.company}</p>}
            {r.address && <p><strong>Адрес:</strong> {r.address}</p>}
            {r.city && <p><strong>Град:</strong> {r.city}</p>}
            {r.tax_number && <p><strong>ЕИК/Булстат:</strong> {r.tax_number}</p>}
            {r.mol && <p><strong>МОЛ:</strong> {r.mol}</p>}
            {r.email && <p><strong>Email:</strong> {r.email}</p>}
            {r.phone && <p><strong>Телефон:</strong> {r.phone}</p>}
          </div>
        </section>
      )}

      <p className="font-medium mb-2">{offer.title}</p>
      {offer.description && <p className="text-sm text-gray-700 mb-4 whitespace-pre-wrap">{offer.description}</p>}

      {lineItems.length > 0 ? (
        <table className="w-full border-collapse border border-gray-300 text-sm mb-4">
          <thead>
            <tr className="bg-gray-100">
              <th className="border border-gray-300 p-2 text-left">№</th>
              <th className="border border-gray-300 p-2 text-left">Артикул и Каталожен №</th>
              <th className="border border-gray-300 p-2 text-right">Количество</th>
              <th className="border border-gray-300 p-2 text-right">Крайна цена</th>
              <th className="border border-gray-300 p-2 text-right">Стойност</th>
            </tr>
          </thead>
          <tbody>
            {lineItems.map((item, i) => (
              <tr key={i}>
                <td className="border border-gray-300 p-2">{i + 1}</td>
                <td className="border border-gray-300 p-2">{item.name}{item.catalog_no ? ` (${item.catalog_no})` : ''}</td>
                <td className="border border-gray-300 p-2 text-right">{item.quantity}</td>
                <td className="border border-gray-300 p-2 text-right">{item.unit_price.toFixed(2)} {offer.currency}</td>
                <td className="border border-gray-300 p-2 text-right">{(item.quantity * item.unit_price).toFixed(2)} {offer.currency}</td>
              </tr>
            ))}
          </tbody>
        </table>
      ) : (
        <div className="border border-gray-300 p-4 mb-4">
          <p className="font-medium">Обща стойност:</p>
          <p className="text-lg">{total.toFixed(2)} {offer.currency}</p>
        </div>
      )}

      {lineItems.length > 0 && (
        <p className="text-right font-medium mb-6">
          Общо: {total.toFixed(2)} {offer.currency}
        </p>
      )}

      {offer.notes && (
        <section className="mt-4 pt-4 border-t border-gray-300 text-sm text-gray-600">
          <p className="font-medium text-gray-700">Бележки</p>
          <p className="whitespace-pre-wrap">{offer.notes}</p>
        </section>
      )}

      <footer className="mt-8 pt-4 border-t border-gray-300 text-xs text-gray-500">
        <p>Оферта № (вътрешен реф.) — {offer.id.slice(0, 8)}</p>
      </footer>
    </div>
  )
}
