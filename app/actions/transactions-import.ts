'use server'

import { createClient } from '@/lib/supabase/server'
import { createAccount } from './accounts'
import { createTransaction } from './transactions'
import { revalidatePath } from 'next/cache'

// Note: This requires the 'xlsx' package to be installed
// Run: npm install xlsx
// The xlsx package includes its own TypeScript types, so @types/xlsx is not needed

interface ExcelTransactionRow {
  Date?: string | number | Date | null
  Number?: string | number | null
  Type?: string | null
  Category?: string | null
  Account?: string | null
  Contact?: string | null
  Document?: string | null
  Amount?: string | number | null
  [key: string]: any // Allow other columns
}

export async function importTransactionsFromExcel(formData: FormData): Promise<{
  success: boolean
  message: string
  accountsCreated: number
  transactionsCreated: number
  errors: string[]
}> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    throw new Error('Unauthorized')
  }

  const file = formData.get('file') as File
  if (!file) {
    throw new Error('No file provided')
  }

  // Dynamically import xlsx library
  let XLSX: any
  try {
    XLSX = await import('xlsx')
  } catch (error) {
    throw new Error(
      'xlsx package is not installed. Please run: npm install xlsx'
    )
  }

  const errors: string[] = []
  let accountsCreated = 0
  let transactionsCreated = 0

  try {
    // Read the Excel file with options to preserve dates and handle formatting
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array', 
      cellDates: true,  // Parse dates as Date objects
      cellNF: false,    // Don't parse number formats
      cellText: false,  // Use raw values
      dateNF: 'yyyy-mm-dd' // Date format hint
    })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    // First, try reading with header row and formatted values
    let rawData = XLSX.utils.sheet_to_json(worksheet, { 
      raw: false,  // Get formatted values for dates (strings)
      defval: null, // Default value for empty cells
      blankrows: false // Skip blank rows
    }) as any[]
    
    // If that doesn't work well, try with raw values to get Date objects
    if (rawData.length === 0 || !rawData[0] || Object.keys(rawData[0]).length === 0) {
      rawData = XLSX.utils.sheet_to_json(worksheet, { 
        raw: true,  // Get raw values (Date objects for dates)
        defval: null,
        blankrows: false
      }) as any[]
    }
    
    if (rawData.length === 0) {
      throw new Error('Excel file is empty or has no data')
    }

    // Log first few rows to debug (always log for import issues)
    if (rawData.length > 0) {
      console.log('[IMPORT] Excel columns found:', Object.keys(rawData[0] || {}))
      console.log('[IMPORT] First row sample:', JSON.stringify(rawData[0], null, 2))
      if (rawData.length > 1) {
        console.log('[IMPORT] Second row sample:', JSON.stringify(rawData[1], null, 2))
      }
    }

    // Normalize column names - handle case-insensitive matching and common variations
    const normalizeKey = (key: string): string => {
      return key.toLowerCase().trim().replace(/\s+/g, '_').replace(/[^\w]/g, '')
    }

    // Build column mapping from first row
    const columnMap: Record<string, string> = {}
    const firstRow = rawData[0] as any
    if (firstRow) {
      Object.keys(firstRow).forEach((key) => {
        const normalized = normalizeKey(key)
        // Date columns - check for paid_at, date, created_at, etc.
        if (normalized.includes('paid_at') || normalized.includes('paidat') || 
            normalized.includes('date') || normalized.includes('дата') || 
            normalized.includes('datum') || normalized.includes('created_at') ||
            normalized.includes('transaction_date')) {
          columnMap[key] = 'Date'
        } 
        // Number columns
        else if ((normalized.includes('number') || normalized.includes('num') || normalized.includes('номер')) && 
                 !normalized.includes('invoice') && !normalized.includes('bill')) {
          columnMap[key] = 'Number'
        } 
        // Type columns
        else if (normalized.includes('type') || normalized.includes('тип')) {
          columnMap[key] = 'Type'
        } 
        // Category columns
        else if (normalized.includes('category') || normalized.includes('cat') || normalized.includes('категория') || normalized.includes('category_name')) {
          columnMap[key] = 'Category'
        } 
        // Account columns - prefer account_name over account
        else if (normalized.includes('account_name') || normalized.includes('accountname')) {
          columnMap[key] = 'Account'
        } else if (normalized.includes('account') && !normalized.includes('number')) {
          columnMap[key] = 'Account'
        } 
        // Contact columns - prefer contact_email or contact name
        else if (normalized.includes('contact_email') || normalized.includes('contactemail')) {
          columnMap[key] = 'Contact'
        } else if ((normalized.includes('contact') || normalized.includes('customer') || normalized.includes('client') || normalized.includes('контакт')) && 
                   !normalized.includes('email')) {
          columnMap[key] = 'Contact'
        } 
        // Document/Reference columns
        else if (normalized.includes('reference') || normalized.includes('ref')) {
          columnMap[key] = 'Document'
        } else if (normalized.includes('document') || normalized.includes('doc') || normalized.includes('документ') || 
                   normalized.includes('invoice_bill_number') || normalized.includes('description')) {
          columnMap[key] = 'Document'
        } 
        // Amount columns
        else if (normalized.includes('amount') || normalized.includes('sum') || normalized.includes('total') || normalized.includes('сума')) {
          columnMap[key] = 'Amount'
        }
      })
    }
    
    // Handle duplicate column names (e.g., "Type" and "type") - prefer capitalized version
    const duplicateKeys = Object.keys(columnMap).filter(k => {
      const normalized = normalizeKey(k)
      return Object.keys(columnMap).some(other => other !== k && normalizeKey(other) === normalized)
    })
    
    // If we have duplicates, prefer the one that matches our expected format better
    duplicateKeys.forEach(key => {
      const normalized = normalizeKey(key)
      const betterMatch = Object.keys(columnMap).find(k => 
        k !== key && normalizeKey(k) === normalized && 
        (k === 'Date' || k === 'Number' || k === 'Type' || k === 'Category' || 
         k === 'Account' || k === 'Contact' || k === 'Document' || k === 'Amount')
      )
      if (betterMatch && betterMatch !== key) {
        delete columnMap[key]
      }
    })

    // Transform data to use normalized column names
    const data: ExcelTransactionRow[] = rawData.map((row: any) => {
      const transformed: any = {}
      Object.keys(row).forEach((key) => {
        const mappedKey = columnMap[key]
        if (mappedKey) {
          transformed[mappedKey] = row[key]
        }
        // Also keep original key for fallback
        transformed[key] = row[key]
      })
      return transformed
    })

    // Get existing accounts to avoid duplicates
    const { data: existingAccounts } = await supabase
      .from('accounts')
      .select('id, name')
      .eq('owner_id', user.id)

    const accountsMap = new Map<string, string>()
    existingAccounts?.forEach((acc) => {
      accountsMap.set(acc.name.toLowerCase().trim(), acc.id)
    })

    // Get existing clients for contact matching
    const { data: existingClients } = await supabase
      .from('clients')
      .select('id, name, email')
      .eq('owner_id', user.id)

    const clientsMap = new Map<string, string>()
    existingClients?.forEach((client) => {
      const key = client.name?.toLowerCase().trim() || ''
      if (key) clientsMap.set(key, client.id)
      if (client.email) {
        clientsMap.set(client.email.toLowerCase().trim(), client.id)
      }
    })

    // Process each row
    for (let i = 0; i < data.length; i++) {
      const row = data[i]
      try {
        // Parse date - try multiple approaches
        let dateStr: string | null = null
        
        // Try Date column first (mapped)
        let dateValue = row.Date
        
        // If Date is not found, try paid_at (common in accounting exports)
        if (!dateValue || dateValue === null || dateValue === '' || dateValue === undefined) {
          dateValue = row.paid_at || row.paidAt || row['paid_at']
        }
        
        // If still not found, try other possible date column names from original row
        if (!dateValue || dateValue === null || dateValue === '' || dateValue === undefined) {
          // Try common date column variations in original keys
          const dateKeys = Object.keys(row).filter(k => {
            const normalized = k.toLowerCase().trim()
            return (normalized.includes('paid_at') || normalized.includes('paidat') ||
                   normalized.includes('date') || 
                   normalized.includes('дата') ||
                   normalized.includes('datum') ||
                   normalized.includes('день') ||
                   normalized.includes('ден') ||
                   normalized.includes('created_at') ||
                   normalized.includes('transaction_date')) && 
                   k !== 'Date' // Don't check the mapped Date again
          })
          if (dateKeys.length > 0) {
            // Prefer paid_at if available
            const paidAtKey = dateKeys.find(k => k.toLowerCase().includes('paid'))
            dateValue = row[paidAtKey || dateKeys[0]]
          }
        }
        
        // If still not found, check if there's a date-like value in any column
        // Also check first few columns as they often contain dates
        if (!dateValue || dateValue === null || dateValue === '' || dateValue === undefined) {
          // Get all column values in order
          const entries = Object.entries(row)
          
          // Check first 3 columns (dates are usually in first column)
          for (let j = 0; j < Math.min(3, entries.length); j++) {
            const [key, value] = entries[j]
            if (value !== null && value !== undefined && value !== '') {
              // Check if it looks like a date
              if (value instanceof Date) {
                dateValue = value
                break
              } else if (typeof value === 'number' && value > 40000 && value < 50000) {
                // Excel date serial numbers are typically in this range (for dates after 2000)
                dateValue = value
                break
              } else if (typeof value === 'string') {
                const strValue = value.trim()
                // Check various date patterns
                if (strValue.match(/\d{1,2}\s+\w+\s+\d{4}/i) || // "23 Dec 2025"
                    strValue.match(/\d{1,2}[\/\-\.]\d{1,2}[\/\-\.]\d{2,4}/) || // "23/12/2025"
                    strValue.match(/\d{4}[\/\-\.]\d{1,2}[\/\-\.]\d{1,2}/) || // "2025-12-23"
                    strValue.match(/\d{1,2}\s+\w{3,}\s+\d{4}/i)) { // "23 December 2025"
                  dateValue = value
                  break
                }
              }
            }
          }
        }

        if (dateValue instanceof Date) {
          dateStr = dateValue.toISOString().split('T')[0]
        } else if (typeof dateValue === 'number') {
          // Excel date serial number (days since 1900-01-01)
          // Excel incorrectly treats 1900 as a leap year, so we need to adjust
          const excelEpoch = new Date(1899, 11, 30)
          const date = new Date(excelEpoch.getTime() + dateValue * 86400000)
          dateStr = date.toISOString().split('T')[0]
        } else if (typeof dateValue === 'string' && dateValue.trim() !== '') {
          // Try to parse various date string formats
          // Handle formats like "23 Dec 2025", "2025-12-23", "12/23/2025", etc.
          let parsed: Date | null = null
          const dateStrValue = dateValue.trim()
          
          // Try format: "23 Dec 2025" or "23 Dec, 2025" (most common in the Excel)
          const dateMatch = dateStrValue.match(/(\d{1,2})\s+(\w+)\s+(\d{4})/)
          if (dateMatch) {
            const months: Record<string, number> = {
              'jan': 0, 'january': 0, 'ян': 0, 'януари': 0, 'janv': 0,
              'feb': 1, 'february': 1, 'фев': 1, 'февруари': 1, 'fev': 1,
              'mar': 2, 'march': 2, 'мар': 2, 'март': 2,
              'apr': 3, 'april': 3, 'апр': 3, 'април': 3, 'avr': 3,
              'may': 4, 'май': 4, 'mai': 4,
              'jun': 5, 'june': 5, 'юни': 5, 'juin': 5,
              'jul': 6, 'july': 6, 'юли': 6, 'juil': 6,
              'aug': 7, 'august': 7, 'авг': 7, 'август': 7, 'aout': 7,
              'sep': 8, 'september': 8, 'сеп': 8, 'септември': 8, 'sept': 8,
              'oct': 9, 'october': 9, 'окт': 9, 'октомври': 9,
              'nov': 10, 'november': 10, 'ное': 10, 'ноември': 10,
              'dec': 11, 'december': 11, 'дек': 11, 'декември': 11,
            }
            const day = parseInt(dateMatch[1])
            const monthName = dateMatch[2].toLowerCase().replace(',', '').trim()
            const year = parseInt(dateMatch[3])
            const month = months[monthName]
            if (month !== undefined) {
              parsed = new Date(year, month, day)
            }
          }
          
          // If that didn't work, try direct parsing
          if (!parsed || isNaN(parsed.getTime())) {
            parsed = new Date(dateStrValue)
          }
          
          // If still not parsed, try ISO format or other common formats
          if (!parsed || isNaN(parsed.getTime())) {
            // Try YYYY-MM-DD
            const isoMatch = dateStrValue.match(/(\d{4})[\/\-\.](\d{1,2})[\/\-\.](\d{1,2})/)
            if (isoMatch) {
              parsed = new Date(parseInt(isoMatch[1]), parseInt(isoMatch[2]) - 1, parseInt(isoMatch[3]))
            }
          }
          
          // Try DD/MM/YYYY or MM/DD/YYYY
          if (!parsed || isNaN(parsed.getTime())) {
            const slashMatch = dateStrValue.match(/(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{2,4})/)
            if (slashMatch) {
              const part1 = parseInt(slashMatch[1])
              const part2 = parseInt(slashMatch[2])
              const part3 = parseInt(slashMatch[3])
              const year = part3 > 100 ? part3 : 2000 + part3
              // Try both DD/MM/YYYY and MM/DD/YYYY
              parsed = new Date(year, part2 - 1, part1)
              if (isNaN(parsed.getTime())) {
                parsed = new Date(year, part1 - 1, part2)
              }
            }
          }
          
          if (parsed && !isNaN(parsed.getTime())) {
            dateStr = parsed.toISOString().split('T')[0]
          } else {
            // Log the actual row data for debugging
            console.log(`[IMPORT] Row ${i + 2} date parse failed. Value:`, dateValue, 'Type:', typeof dateValue, 'Row:', JSON.stringify(row))
            errors.push(`Row ${i + 2}: Invalid date format: "${dateValue}". Available columns: ${Object.keys(row).slice(0, 5).join(', ')}`)
            continue
          }
        } else {
          // Date is missing or null - provide helpful error with available columns
          console.log(`[IMPORT] Row ${i + 2} missing date. Full row:`, JSON.stringify(row))
          errors.push(`Row ${i + 2}: Missing date. Available columns: ${Object.keys(row).join(', ')}. First few values: ${JSON.stringify(Object.fromEntries(Object.entries(row).slice(0, 3)))}`)
          continue
        }
        
        if (!dateStr) {
          console.log(`[IMPORT] Row ${i + 2} dateStr is null after parsing. dateValue:`, dateValue)
          errors.push(`Row ${i + 2}: Could not parse date from value: ${JSON.stringify(dateValue)}`)
          continue
        }

        // Parse amount - handle Bulgarian format (лв330,00)
        // Try Amount or amount column
        let amountValue = row.Amount !== undefined ? row.Amount : row.amount
        let amount: number
        
        if (typeof amountValue === 'number') {
          amount = Math.abs(amountValue)
        } else if (typeof amountValue === 'string') {
          // Remove currency symbols (лв, BGN, etc.) and spaces
          // Handle both comma and dot as decimal separator
          let cleaned = amountValue
            .replace(/лв/gi, '')
            .replace(/bgn/gi, '')
            .replace(/\s/g, '')
            .trim()
          
          // If it has a comma, it's likely Bulgarian format (comma = decimal separator)
          // If it has a dot, check if it's thousands separator or decimal
          if (cleaned.includes(',')) {
            // Bulgarian format: comma is decimal separator
            cleaned = cleaned.replace(/\./g, '').replace(',', '.')
          } else if (cleaned.match(/\d+\.\d{3}/)) {
            // Has dot with 3 digits after - likely thousands separator
            cleaned = cleaned.replace(/\./g, '')
          }
          
          amount = Math.abs(parseFloat(cleaned) || 0)
        } else if (amountValue === null || amountValue === undefined || amountValue === '') {
          errors.push(`Row ${i + 2}: Missing amount. Available columns: ${Object.keys(row).filter(k => k.toLowerCase().includes('amount') || k.toLowerCase().includes('sum')).join(', ')}`)
          continue
        } else {
          errors.push(`Row ${i + 2}: Invalid amount format: ${JSON.stringify(amountValue)}`)
          continue
        }

        if (amount === 0) {
          errors.push(`Row ${i + 2}: Amount is zero, skipping`)
          continue
        }

        // Determine transaction type from Type column or Category
        // Handle formats like "income", "expense", "income-transfer", "expense-transfer"
        let transactionType: 'income' | 'expense' | 'transfer' = 'expense'
        const typeStr = (row.Type || row.type || '').toString().toLowerCase().trim()
        const categoryStr = (row.Category || row.category_name || '').toString().toLowerCase().trim()

        // Check for transfer first (can be "income-transfer" or "expense-transfer")
        if (typeStr.includes('transfer') || categoryStr.includes('transfer')) {
          transactionType = 'transfer'
        } else if (typeStr === 'income' || typeStr.startsWith('income')) {
          transactionType = 'income'
        } else if (typeStr === 'expense' || typeStr.startsWith('expense')) {
          transactionType = 'expense'
        } else if (categoryStr === 'sales' || categoryStr.includes('sales')) {
          transactionType = 'income'
        } else {
          // Default: if amount is positive and category suggests income, treat as income
          // Otherwise treat as expense
          if (categoryStr && ['sales', 'income'].some(s => categoryStr.includes(s))) {
            transactionType = 'income'
          } else {
            transactionType = 'expense'
          }
        }

        // Get or create account - try account_name if Account is not available
        let accountName = (row.Account || row.account_name || '').toString().trim()
        if (!accountName || accountName === 'N/A') {
          errors.push(`Row ${i + 2}: Missing account name. Available: ${Object.keys(row).filter(k => k.toLowerCase().includes('account')).join(', ')}`)
          continue
        }

        let accountId = accountsMap.get(accountName.toLowerCase())
        if (!accountId) {
          try {
            // Detect account type from name
            let accountType: 'bank' | 'cash' | 'credit_card' | 'other' = 'bank'
            const accountNameLower = accountName.toLowerCase()
            if (accountNameLower.includes('cash')) {
              accountType = 'cash'
            } else if (accountNameLower.includes('revolut') || accountNameLower.includes('card')) {
              accountType = 'credit_card'
            } else if (accountNameLower.includes('bank') || accountNameLower.includes('account')) {
              accountType = 'bank'
            }

            const newAccount = await createAccount({
              name: accountName,
              type: accountType,
              currency: 'BGN',
              opening_balance: 0,
            })
            accountId = newAccount.id
            accountsMap.set(accountName.toLowerCase(), accountId)
            accountsCreated++
          } catch (error) {
            errors.push(`Row ${i + 2}: Failed to create account "${accountName}": ${error instanceof Error ? error.message : 'Unknown error'}`)
            continue
          }
        }

        // Get contact/client ID if provided - try contact_email or Contact
        let contactId: string | undefined
        let contactName = (row.Contact || row.contact_email || '').toString().trim()
        
        // If we have contact_email, try to find client by email first
        if (row.contact_email && typeof row.contact_email === 'string') {
          const email = row.contact_email.toLowerCase().trim()
          contactId = clientsMap.get(email)
          if (contactId) {
            contactName = email // Use email for reference
          }
        }
        
        // If not found by email, try by name
        if (!contactId && contactName && contactName !== 'N/A' && contactName !== '') {
          // Try exact match first
          contactId = clientsMap.get(contactName.toLowerCase())
          
          // If not found, try partial match (e.g., "Rumen - midwestlab" might match "Rumen")
          if (!contactId) {
            const contactParts = contactName.split('-').map(s => s.trim().toLowerCase())
            for (const part of contactParts) {
              if (part && clientsMap.has(part)) {
                contactId = clientsMap.get(part)
                break
              }
            }
          }
          
          // If still not found, transaction will be created without contact link (non-fatal)
        }

        // Get category - try category_name if Category is not available
        let category = (row.Category || row.category_name || '').toString().trim()
        if (!category || category === 'N/A') {
          category = undefined
        }

        // Get transaction number - extract from Number column or generate
        // Try both Number and number columns
        let transactionNumber = (row.Number || row.number || row.parent_number || '').toString().trim()
        
        // If number is in format like "TRA-00575", use it; otherwise we'll auto-generate
        // Also handle cases where Number might be just a number
        if (!transactionNumber || transactionNumber === 'N/A' || transactionNumber === '' || transactionNumber === 'null') {
          transactionNumber = '' // Will be auto-generated
        } else if (!transactionNumber.startsWith('TRA-')) {
          // If it's just a number, format it as TRA-XXXXX
          const num = parseInt(transactionNumber)
          if (!isNaN(num)) {
            transactionNumber = `TRA-${String(num).padStart(5, '0')}`
          }
        }

        // Get description/reference - try description, Document, or reference columns
        const documentValue = (row.Document || row.description || row.reference || '').toString().trim()
        const description = documentValue && documentValue !== 'N/A' && documentValue !== '' ? documentValue : undefined
        
        // Reference can be from reference column, invoice_bill_number, or transaction number
        let reference = (row.reference || row.invoice_bill_number || '').toString().trim()
        if (!reference || reference === 'N/A') {
          reference = transactionNumber || undefined
        }

        // Create transaction
        try {
          // Check if transaction with this number already exists (to avoid duplicates)
          if (transactionNumber) {
            const { data: existing } = await supabase
              .from('transactions')
              .select('id')
              .eq('owner_id', user.id)
              .eq('number', transactionNumber)
              .limit(1)

            if (existing && existing.length > 0) {
              errors.push(`Row ${i + 2}: Transaction ${transactionNumber} already exists, skipping`)
              continue
            }
          }

          await createTransaction({
            account_id: accountId,
            type: transactionType,
            date: dateStr,
            amount: amount,
            currency: (row.currency_code || 'BGN').toString().trim() || 'BGN',
            category: category,
            payment_method: (row.payment_method || 'bank_transfer').toString().trim() || 'bank_transfer',
            description: description,
            reference: reference,
            contact_id: contactId,
            number: transactionNumber || undefined, // Use provided number if available
          })
          transactionsCreated++
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : 'Unknown error'
          // Check if it's a duplicate number error
          if (errorMsg.includes('unique') || errorMsg.includes('duplicate')) {
            errors.push(`Row ${i + 2}: Transaction number ${transactionNumber} already exists, skipping`)
          } else {
            errors.push(`Row ${i + 2}: Failed to create transaction: ${errorMsg}`)
          }
        }
      } catch (error) {
        errors.push(`Row ${i + 2}: Error processing row: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    revalidatePath('/accounting/transactions')
    revalidatePath('/accounting/accounts')

    const success = transactionsCreated > 0
    const message = success
      ? `Successfully imported ${transactionsCreated} transaction(s) and created ${accountsCreated} account(s)`
      : `No transactions were imported. ${errors.length} error(s) occurred.`

    return {
      success,
      message,
      accountsCreated,
      transactionsCreated,
      errors: errors.slice(0, 50), // Limit to first 50 errors
    }
  } catch (error) {
    throw new Error(`Failed to import transactions: ${error instanceof Error ? error.message : 'Unknown error'}`)
  }
}











