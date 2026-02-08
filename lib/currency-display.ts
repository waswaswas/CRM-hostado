/** Fixed exchange rate: 1 EUR = 1.95583 BGN */
export const EUR_TO_BGN = 1.95583

export type CurrencyDisplayMode = 'eur' | 'bgn' | 'both'

export function convertToBGN(amount: number, currency: string): number {
  const c = toUpper(currency)
  if (c === 'EUR') return amount * EUR_TO_BGN
  return amount
}

export function convertToEUR(amount: number, currency: string): number {
  const c = toUpper(currency)
  if (c === 'BGN') return amount / EUR_TO_BGN
  return amount
}

function toUpper(s: string): string {
  return (s || 'BGN').toUpperCase()
}

function formatBGN(amount: number): string {
  return new Intl.NumberFormat('bg-BG', {
    style: 'currency',
    currency: 'BGN',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

function formatEUR(amount: number): string {
  return new Intl.NumberFormat('bg-BG', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(amount)
}

/**
 * Format amount for display based on selected mode.
 * @param amount - The numeric amount
 * @param originalCurrency - Currency of the amount (BGN or EUR)
 * @param mode - Display mode: eur only, bgn only, or both
 */
export function formatForDisplay(
  amount: number,
  originalCurrency: string,
  mode: CurrencyDisplayMode
): string {
  const c = toUpper(originalCurrency || 'BGN')

  if (mode === 'eur') {
    const eur = c === 'EUR' ? amount : amount / EUR_TO_BGN
    return formatEUR(eur)
  }

  if (mode === 'bgn') {
    const bgn = c === 'BGN' ? amount : amount * EUR_TO_BGN
    return formatBGN(bgn)
  }

  // mode === 'both'
  const bgn = c === 'BGN' ? amount : amount * EUR_TO_BGN
  const eur = c === 'EUR' ? amount : amount / EUR_TO_BGN
  return `${formatBGN(bgn)} (${formatEUR(eur)})`
}
