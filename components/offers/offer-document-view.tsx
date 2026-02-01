'use client'

import { useEffect } from 'react'
import { OffertaDocument } from './offerta-document'
import type { Offer } from '@/types/database'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { ArrowLeft, Printer } from 'lucide-react'

interface OfferDocumentViewProps {
  offer: Offer
  autoPrint?: boolean
}

export function OfferDocumentView({ offer, autoPrint }: OfferDocumentViewProps) {
  useEffect(() => {
    if (autoPrint && typeof window !== 'undefined') {
      const t = setTimeout(() => window.print(), 500)
      return () => clearTimeout(t)
    }
  }, [autoPrint])

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 print:hidden">
        <Link href={`/offers/${offer.id}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back
          </Button>
        </Link>
        <Button variant="outline" size="sm" onClick={() => window.print()}>
          <Printer className="h-4 w-4 mr-1" />
          Print / Save as PDF
        </Button>
        <Link href={`/offers/${offer.id}/document?print=1`} target="_blank" rel="noopener noreferrer">
          <Button variant="outline" size="sm">
            Open for printing
          </Button>
        </Link>
      </div>
      <OffertaDocument offer={offer} />
    </div>
  )
}
