'use client'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { OfferLineItem } from '@/types/database'
import { Plus, Trash2 } from 'lucide-react'

export const emptyLineItem: OfferLineItem = { name: '', quantity: 1, unit_price: 0 }

interface OfferLineItemsEditorProps {
  lineItems: OfferLineItem[]
  onChange: (items: OfferLineItem[]) => void
  currency?: string
  disabled?: boolean
}

export function computeLineItemsTotal(lineItems: OfferLineItem[]): number {
  return lineItems.reduce((s, i) => s + i.quantity * i.unit_price, 0)
}

export function hasUsableLineItems(lineItems: OfferLineItem[]): boolean {
  return lineItems.some((i) => i.name.trim() && i.quantity * i.unit_price > 0)
}

export function filterValidLineItems(lineItems: OfferLineItem[]): OfferLineItem[] {
  return lineItems.filter((i) => i.name.trim() && i.quantity * i.unit_price > 0)
}

export function OfferLineItemsEditor({
  lineItems,
  onChange,
  currency = 'EUR',
  disabled = false,
}: OfferLineItemsEditorProps) {
  function updateLineItem(index: number, patch: Partial<OfferLineItem>) {
    onChange(
      lineItems.map((item, i) => (i === index ? { ...item, ...patch } : item))
    )
  }

  function addLineItem() {
    onChange([...lineItems, { ...emptyLineItem }])
  }

  function removeLineItem(index: number) {
    if (lineItems.length <= 1) return
    onChange(lineItems.filter((_, i) => i !== index))
  }

  const total = computeLineItemsTotal(lineItems)
  const useLineItems = hasUsableLineItems(lineItems)

  return (
    <div className="space-y-2">
      <label className="text-sm font-medium">Line items (Артикул, Количество, Цена без ДДС)</label>
      {lineItems.map((item, i) => (
        <div key={i} className="flex flex-wrap gap-2 items-end border p-2 rounded-md">
          <Input
            placeholder="Артикул / Name"
            value={item.name}
            onChange={(e) => updateLineItem(i, { name: e.target.value })}
            disabled={disabled}
            className="min-w-[140px]"
          />
          <Input
            placeholder="Каталожен №"
            value={item.catalog_no || ''}
            onChange={(e) => updateLineItem(i, { catalog_no: e.target.value || undefined })}
            disabled={disabled}
            className="w-24"
          />
          <Input
            type="number"
            min={0.01}
            step={0.01}
            placeholder="Количество"
            value={item.quantity || ''}
            onChange={(e) => updateLineItem(i, { quantity: Number(e.target.value) || 0 })}
            disabled={disabled}
            className="w-24"
          />
          <Input
            type="number"
            min={0}
            step={0.01}
            placeholder="Цена без ДДС"
            value={item.unit_price || ''}
            onChange={(e) => updateLineItem(i, { unit_price: Number(e.target.value) || 0 })}
            disabled={disabled}
            className="w-28"
          />
          <span className="text-sm text-muted-foreground w-20">
            = {(item.quantity * item.unit_price).toFixed(2)}
          </span>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => removeLineItem(i)}
            disabled={disabled || lineItems.length <= 1}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <Button type="button" variant="outline" size="sm" onClick={addLineItem} disabled={disabled}>
        <Plus className="h-4 w-4 mr-1" />
        Add line
      </Button>
      {useLineItems && (
        <p className="text-sm font-medium">
          Total: {total.toFixed(2)} {currency}
        </p>
      )}
    </div>
  )
}
