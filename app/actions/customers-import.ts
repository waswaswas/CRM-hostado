'use server'

import { createClient } from '@/lib/supabase/server'
import { createAccountingCustomer } from './accounting-customers'
import { revalidatePath } from 'next/cache'

interface ExcelCustomerRow {
  Name?: string | null
  Company?: string | null
  Email?: string | null
  Phone?: string | null
  Address?: string | null
  [key: string]: any // Allow other columns
}

export async function importCustomersFromExcel(formData: FormData): Promise<{
  success: boolean
  message: string
  customersCreated: number
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
  let customersCreated = 0

  try {
    const arrayBuffer = await file.arrayBuffer()
    const workbook = XLSX.read(arrayBuffer, { 
      type: 'array',
      cellDates: true,
      cellNF: false,
      cellText: false,
      dateNF: 'yyyy-mm-dd'
    })
    const sheetName = workbook.SheetNames[0]
    const worksheet = workbook.Sheets[sheetName]
    
    let rawData = XLSX.utils.sheet_to_json(worksheet, { 
      raw: false,
      defval: null,
      blankrows: false
    }) as any[]
    
    if (rawData.length === 0 || !rawData[0] || Object.keys(rawData[0]).length === 0) {
      rawData = XLSX.utils.sheet_to_json(worksheet, { 
        raw: true,
        defval: null,
        blankrows: false
      }) as any[]
    }
    
    if (rawData.length === 0) {
      throw new Error('Excel file is empty or has no data')
    }

    // Normalize column names (case-insensitive, handle spaces)
    const normalizeKey = (key: string) => key.toLowerCase().trim().replace(/\s+/g, '_')

    // Build column mapping from first row
    const columnMap: Record<string, string> = {}
    const firstRow = rawData[0] as any
    if (firstRow) {
      Object.keys(firstRow).forEach((key) => {
        const normalized = normalizeKey(key)
        if (normalized.includes('name') || normalized.includes('име')) {
          columnMap[key] = 'Name'
        } else if (normalized.includes('company') || normalized.includes('компания') || normalized.includes('firm')) {
          columnMap[key] = 'Company'
        } else if (normalized.includes('email') || normalized.includes('имейл')) {
          columnMap[key] = 'Email'
        } else if (normalized.includes('phone') || normalized.includes('телефон') || normalized.includes('tel')) {
          columnMap[key] = 'Phone'
        } else if (normalized.includes('address') || normalized.includes('адрес') || normalized.includes('address')) {
          columnMap[key] = 'Address'
        }
      })
    }

    // Get existing accounting customers to check for duplicates
    const { data: existingCustomers } = await supabase
      .from('accounting_customers')
      .select('id, name, email, phone')
      .eq('owner_id', user.id)

    const customersMap = new Map<string, string>()
    existingCustomers?.forEach(customer => {
      if (customer.email) customersMap.set(customer.email.toLowerCase(), customer.id)
      if (customer.phone) customersMap.set(customer.phone.replace(/\s/g, ''), customer.id)
      if (customer.name) customersMap.set(customer.name.toLowerCase(), customer.id)
    })

    // Process each row
    for (let i = 0; i < rawData.length; i++) {
      const row = rawData[i] as ExcelCustomerRow
      
      try {
        // Map columns
        const mappedRow: any = {}
        Object.keys(row).forEach(key => {
          const mappedKey = columnMap[key] || key
          mappedRow[mappedKey] = row[key]
        })

        // Get customer data
        const name = (mappedRow.Name || '').toString().trim()
        if (!name || name === 'N/A' || name === '') {
          errors.push(`Row ${i + 2}: Missing name`)
          continue
        }

        const company = (mappedRow.Company || '').toString().trim() || undefined
        const email = (mappedRow.Email || '').toString().trim() || undefined
        const phone = (mappedRow.Phone || '').toString().trim() || undefined
        const address = (mappedRow.Address || '').toString().trim() || undefined

        // Check for duplicates by email or phone
        let isDuplicate = false
        if (email) {
          isDuplicate = customersMap.has(email.toLowerCase())
        }
        if (!isDuplicate && phone) {
          isDuplicate = customersMap.has(phone.replace(/\s/g, ''))
        }
        if (!isDuplicate) {
          isDuplicate = customersMap.has(name.toLowerCase())
        }

        if (isDuplicate) {
          errors.push(`Row ${i + 2}: Customer "${name}" already exists (skipped)`)
          continue
        }

        // Create accounting customer
        await createAccountingCustomer({
          name,
          company,
          email,
          phone,
          address,
        })

        customersCreated++

        // Add to map to prevent duplicates in same import
        if (email) customersMap.set(email.toLowerCase(), '')
        if (phone) customersMap.set(phone.replace(/\s/g, ''), '')
        customersMap.set(name.toLowerCase(), '')

      } catch (error) {
        errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`)
      }
    }

    revalidatePath('/accounting/customers')
    
    return {
      success: customersCreated > 0,
      message: customersCreated > 0 
        ? `Successfully imported ${customersCreated} customer(s)`
        : 'No customers were imported',
      customersCreated,
      errors: errors.slice(0, 100), // Limit errors to first 100
    }
  } catch (error) {
    return {
      success: false,
      message: error instanceof Error ? error.message : 'Failed to import customers',
      customersCreated: 0,
      errors: [error instanceof Error ? error.message : 'Unknown error'],
    }
  }
}















