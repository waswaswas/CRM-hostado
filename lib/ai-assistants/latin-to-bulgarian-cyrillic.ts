/**
 * Approximate Latin → Bulgarian Cyrillic for CRM names (reverse of official romanization).
 * English or mixed spellings may not map perfectly; output is a hint for the model.
 */
const DIGRAPHS: [string, string][] = [
  ['sht', 'щ'],
  ['zh', 'ж'],
  ['ch', 'ч'],
  ['sh', 'ш'],
  ['ts', 'ц'],
  ['dz', 'дз'],
  ['dj', 'дж'],
  ['yu', 'ю'],
  ['ya', 'я'],
  ['ja', 'я'],
  ['kh', 'х'],
]

const SINGLES: Record<string, string> = {
  a: 'а',
  b: 'б',
  c: 'к',
  d: 'д',
  e: 'е',
  f: 'ф',
  g: 'г',
  h: 'х',
  i: 'и',
  j: 'дж',
  k: 'к',
  l: 'л',
  m: 'м',
  n: 'н',
  o: 'о',
  p: 'п',
  q: 'к',
  r: 'р',
  s: 'с',
  t: 'т',
  u: 'у',
  v: 'в',
  w: 'в',
  x: 'кс',
  y: 'й',
  z: 'з',
}

function titleCaseCyrillicWords(s: string): string {
  return s
    .split(/(\s+|-+)/)
    .map((part) => {
      if (!part.trim() || /^-+$/.test(part)) return part
      const first = part.charAt(0).toUpperCase()
      return first + part.slice(1)
    })
    .join('')
}

export function latinToBulgarianCyrillicApprox(input: string): string {
  const raw = input.trim()
  if (!raw) return raw
  if (/[\u0400-\u04FF]/.test(raw)) return raw

  const lower = raw.toLowerCase()
  let i = 0
  let out = ''
  while (i < lower.length) {
    let matched = false
    for (const [lat, cyr] of DIGRAPHS) {
      if (lower.startsWith(lat, i)) {
        out += cyr
        i += lat.length
        matched = true
        break
      }
    }
    if (matched) continue

    const ch = lower[i]
    if (SINGLES[ch]) {
      out += SINGLES[ch]
      i += 1
      continue
    }

    out += raw[i] ?? ch
    i += 1
  }

  return titleCaseCyrillicWords(out)
}
