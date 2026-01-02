import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export default async function AccountingTestPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  const checks: Array<{ name: string; status: 'success' | 'error'; message: string }> = []

  // Check if accounts table exists
  try {
    const { error } = await supabase.from('accounts').select('id').limit(1)
    if (error) {
      checks.push({
        name: 'Accounts Table',
        status: 'error',
        message: error.message,
      })
    } else {
      checks.push({
        name: 'Accounts Table',
        status: 'success',
        message: 'Table exists and is accessible',
      })
    }
  } catch (err) {
    checks.push({
      name: 'Accounts Table',
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }

  // Check if transactions table exists
  try {
    const { error } = await supabase.from('transactions').select('id').limit(1)
    if (error) {
      checks.push({
        name: 'Transactions Table',
        status: 'error',
        message: error.message,
      })
    } else {
      checks.push({
        name: 'Transactions Table',
        status: 'success',
        message: 'Table exists and is accessible',
      })
    }
  } catch (err) {
    checks.push({
      name: 'Transactions Table',
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }

  // Check if transaction_categories table exists
  try {
    const { error } = await supabase.from('transaction_categories').select('id').limit(1)
    if (error) {
      checks.push({
        name: 'Transaction Categories Table',
        status: 'error',
        message: error.message,
      })
    } else {
      checks.push({
        name: 'Transaction Categories Table',
        status: 'success',
        message: 'Table exists and is accessible',
      })
    }
  } catch (err) {
    checks.push({
      name: 'Transaction Categories Table',
      status: 'error',
      message: err instanceof Error ? err.message : 'Unknown error',
    })
  }

  // Check RLS policies
  try {
    const { data: policies } = await supabase.rpc('exec_sql', {
      sql: `
        SELECT tablename, policyname 
        FROM pg_policies 
        WHERE schemaname = 'public' 
        AND tablename IN ('accounts', 'transactions', 'transaction_categories')
      `,
    })
    checks.push({
      name: 'RLS Policies',
      status: policies ? 'success' : 'error',
      message: policies ? `Found ${policies.length} policies` : 'Could not check policies',
    })
  } catch (err) {
    checks.push({
      name: 'RLS Policies',
      status: 'error',
      message: 'Could not verify RLS policies',
    })
  }

  return (
    <div className="space-y-6 p-6">
      <h1 className="text-3xl font-bold">Accounting Module Diagnostic</h1>
      <div className="space-y-4">
        {checks.map((check, index) => (
          <div
            key={index}
            className={`rounded-lg border p-4 ${
              check.status === 'success'
                ? 'border-green-200 bg-green-50'
                : 'border-red-200 bg-red-50'
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">{check.name}</h3>
              <span
                className={`px-2 py-1 rounded text-sm ${
                  check.status === 'success'
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {check.status === 'success' ? '✓ OK' : '✗ ERROR'}
              </span>
            </div>
            <p className="text-sm mt-2">{check.message}</p>
          </div>
        ))}
      </div>
      <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <h3 className="font-semibold mb-2">Next Steps:</h3>
        <ul className="list-disc list-inside space-y-1 text-sm">
          <li>If any tables are missing, run: <code className="bg-blue-100 px-1 rounded">supabase/migration_accounting.sql</code></li>
          <li>If RLS policies are missing, they should be created by the migration</li>
          <li>Check the Supabase SQL Editor for any migration errors</li>
        </ul>
      </div>
    </div>
  )
}











