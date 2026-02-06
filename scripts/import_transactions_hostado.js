#!/usr/bin/env node
/**
 * Import transactions from Excel files into accounting for organization "hostado"
 *
 * Mapping:
 * 1. type -> transactions.type (income/expense/transfer)
 * 2. number -> transactions.number
 * 3. paid_at -> transactions.date
 * 4. currency_code -> transactions.currency
 * 5. account_name -> account_id (find or create account)
 * 6. category_name -> transactions.category
 * 7. description -> transactions.description
 * 8. payment_method -> transactions.payment_method (normalized)
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_SERVICE_ROLE_KEY=xxx node scripts/import_transactions_hostado.js
 *
 * Or with .env.local:
 *   node -r dotenv/config scripts/import_transactions_hostado.js
 */

const path = require('path')
const fs = require('fs')
const XLSX = require('xlsx')
const { createClient } = require('@supabase/supabase-js')

const ORG_SLUG = 'hostado'
const TRANS_DIR = path.join(__dirname, '..', 'Trans')
const FILES = [
  'Transactions 1.xlsx',
  'Transactions 2.xlsx',
  'Transactions 3.xlsx',
  'Transactions 4.xlsx',
  'Transactions 5.xlsx',
  'Transactions 6.xlsx',
]

function normalizePaymentMethod(val) {
  if (!val || typeof val !== 'string') return 'other'
  const v = val.toLowerCase().trim()
  if (v.includes('bank_transfer') || v.includes('bank transfer')) return 'bank_transfer'
  if (v.includes('cash')) return 'cash'
  if (v.includes('card') || v.includes('credit')) return 'credit_card'
  if (v.includes('paypal')) return 'paypal'
  if (v.includes('stripe')) return 'stripe'
  // Use last meaningful segment (e.g. "offline-payments.bank_transfer.2" -> "bank_transfer")
  const parts = v.split(/[.-]/).filter(Boolean)
  const last = parts[parts.length - 1]
  if (last && !/^\d+$/.test(last)) return last
  return parts.find(p => p.length > 2) || 'other'
}

function parseAmount(val) {
  if (val == null || val === '') return null
  if (typeof val === 'number') return Math.abs(val)
  const s = String(val).replace(/[^\d.,\-]/g, '').replace(',', '.')
  const n = parseFloat(s)
  return isNaN(n) ? null : Math.abs(n)
}

function parseDate(val) {
  if (!val) return null
  if (val instanceof Date) return val.toISOString().split('T')[0]
  if (typeof val === 'number' && val > 40000 && val < 50000) {
    const excelEpoch = new Date(1899, 11, 30)
    return new Date(excelEpoch.getTime() + val * 86400000).toISOString().split('T')[0]
  }
  const s = String(val).trim()
  const m = s.match(/(\d{4})-(\d{2})-(\d{2})/)
  if (m) return `${m[1]}-${m[2]}-${m[3]}`
  const m2 = s.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/)
  if (m2) {
    const y = m2[3].length === 4 ? parseInt(m2[3]) : 2000 + parseInt(m2[3])
    return `${y}-${String(parseInt(m2[2])).padStart(2, '0')}-${String(parseInt(m2[1])).padStart(2, '0')}`
  }
  return null
}

function inferAccountType(name) {
  const n = (name || '').toLowerCase()
  if (n.includes('cash')) return 'cash'
  if (n.includes('card') || n.includes('revolut')) return 'credit_card'
  return 'bank'
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  if (dryRun) console.log('DRY RUN - no data will be written\n')

  const supabaseUrl = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceKey) {
    console.error('Missing SUPABASE_URL and/or SUPABASE_SERVICE_ROLE_KEY')
    console.error('Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... node scripts/import_transactions_hostado.js')
    console.error('       Add --dry-run to validate without writing')
    process.exit(1)
  }

  const supabase = createClient(supabaseUrl, serviceKey, { auth: { persistSession: false } })

  // Get organization "hostado"
  const { data: org, error: orgError } = await supabase
    .from('organizations')
    .select('id, owner_id')
    .eq('slug', ORG_SLUG)
    .single()

  if (orgError || !org) {
    console.error('Organization "hostado" not found:', orgError?.message)
    process.exit(1)
  }

  const organizationId = org.id
  const ownerId = org.owner_id
  console.log('Organization:', ORG_SLUG, 'id:', organizationId, 'owner:', ownerId)

  // Load all rows from Excel files
  const allRows = []
  for (const file of FILES) {
    const filePath = path.join(TRANS_DIR, file)
    if (!fs.existsSync(filePath)) {
      console.warn('File not found:', filePath)
      continue
    }
    const wb = XLSX.readFile(filePath, { cellDates: true })
    const ws = wb.Sheets[wb.SheetNames[0]]
    const data = XLSX.utils.sheet_to_json(ws, { raw: false, defval: null })
    allRows.push(...data)
  }

  console.log('Total rows to process:', allRows.length)

  // Get existing accounts for this org
  const { data: existingAccounts } = await supabase
    .from('accounts')
    .select('id, name')
    .eq('organization_id', organizationId)

  const accountsMap = new Map()
  ;(existingAccounts || []).forEach((a) => {
    accountsMap.set((a.name || '').toLowerCase().trim(), a.id)
  })

  let accountsCreated = 0
  let transactionsCreated = 0
  const seenNumbers = new Set()

  // Load existing transaction numbers to avoid duplicates on re-run
  const { data: existingTx } = await supabase
    .from('transactions')
    .select('number')
    .eq('organization_id', organizationId)
  ;(existingTx || []).forEach((t) => seenNumbers.add(t.number))

  const errors = []

  for (let i = 0; i < allRows.length; i++) {
    const row = allRows[i]
    try {
      const type = (row.type || '').toString().toLowerCase().trim()
      if (!['income', 'expense', 'transfer'].includes(type)) {
        errors.push(`Row ${i + 2}: Invalid type "${type}"`)
        continue
      }

      const number = (row.number || '').toString().trim()
      if (!number) {
        errors.push(`Row ${i + 2}: Missing number`)
        continue
      }
      if (seenNumbers.has(number)) {
        errors.push(`Row ${i + 2}: Duplicate number ${number}, skipping`)
        continue
      }

      const dateStr = parseDate(row.paid_at)
      if (!dateStr) {
        errors.push(`Row ${i + 2}: Invalid date: ${row.paid_at}`)
        continue
      }

      const amount = parseAmount(row.amount)
      if (amount == null || amount <= 0) {
        errors.push(`Row ${i + 2}: Invalid amount: ${row.amount}`)
        continue
      }

      const currency = (row.currency_code || 'BGN').toString().trim() || 'BGN'
      const accountName = (row.account_name || '').toString().trim()
      if (!accountName) {
        errors.push(`Row ${i + 2}: Missing account_name`)
        continue
      }

      let accountId = accountsMap.get(accountName.toLowerCase())
      if (!accountId) {
        if (dryRun) {
          accountId = 'dry-run-placeholder'
          accountsMap.set(accountName.toLowerCase(), accountId)
          accountsCreated++
        } else {
          const { data: newAcc, error: accErr } = await supabase
            .from('accounts')
            .insert({
              owner_id: ownerId,
              organization_id: organizationId,
              name: accountName,
              type: inferAccountType(accountName),
              currency,
              opening_balance: 0,
              current_balance: 0,
            })
            .select('id')
            .single()

          if (accErr) {
            errors.push(`Row ${i + 2}: Failed to create account "${accountName}": ${accErr.message}`)
            continue
          }
          accountId = newAcc.id
          accountsMap.set(accountName.toLowerCase(), accountId)
          accountsCreated++
        }
      }

      const category = (row.category_name || '').toString().trim() || null
      const description = (row.description || '').toString().trim() || null
      const paymentMethod = normalizePaymentMethod(row.payment_method)

      // Skip transfer type for now (would need transfer_to_account_id)
      const txType = type === 'transfer' ? 'expense' : type

      if (!dryRun) {
        const { error: txErr } = await supabase.from('transactions').insert({
          owner_id: ownerId,
          organization_id: organizationId,
          account_id: accountId,
          type: txType,
          number,
          date: dateStr,
          amount,
          currency,
          category,
          payment_method: paymentMethod,
          description,
          reference: (row.reference || '').toString().trim() || null,
          created_by: ownerId,
        })

        if (txErr) {
          if (txErr.code === '23505' || txErr.message?.includes('unique')) {
            errors.push(`Row ${i + 2}: Transaction ${number} already exists, skipping`)
          } else {
            errors.push(`Row ${i + 2}: ${txErr.message}`)
          }
          continue
        }
      }

      seenNumbers.add(number)
      transactionsCreated++
      if (transactionsCreated % 50 === 0) {
        console.log('Progress:', transactionsCreated, 'transactions created')
      }
    } catch (err) {
      errors.push(`Row ${i + 2}: ${err.message}`)
    }
  }

  console.log('\nDone.')
  console.log('Accounts created:', accountsCreated)
  console.log('Transactions created:', transactionsCreated)
  if (errors.length > 0) {
    console.log('\nErrors (' + errors.length + '):')
    errors.slice(0, 30).forEach((e) => console.log('  ', e))
    if (errors.length > 30) console.log('  ... and', errors.length - 30, 'more')
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
