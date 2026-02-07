'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toaster'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2, RefreshCw, Trash2 } from 'lucide-react'
import { importTransactionsFromExcel } from '@/app/actions/transactions-import'
import { recalculateAccountBalances } from '@/app/actions/accounts'
import { deleteAllTransactions } from '@/app/actions/transactions'

const MAX_FILES = 8

export function ImportTransactions() {
  const { toast } = useToast()
  const [files, setFiles] = useState<File[]>([])
  const [loading, setLoading] = useState(false)
  const [recalcLoading, setRecalcLoading] = useState(false)
  const [deleteLoading, setDeleteLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    accountsCreated: number
    transactionsCreated: number
    errors: string[]
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(e.target.files ?? [])
    if (selectedFiles.length > 0) {
      const valid = selectedFiles.filter(
        (f) => f.name.endsWith('.xlsx') || f.name.endsWith('.xls')
      )
      const invalid = selectedFiles.filter(
        (f) => !f.name.endsWith('.xlsx') && !f.name.endsWith('.xls')
      )
      if (invalid.length > 0) {
        toast({
          title: 'Invalid file type',
          description: `${invalid.length} file(s) skipped. Please select Excel files (.xlsx or .xls)`,
          variant: 'destructive',
        })
      }
      if (valid.length > MAX_FILES) {
        toast({
          title: 'Too many files',
          description: `Maximum ${MAX_FILES} files allowed. Using first ${MAX_FILES}.`,
          variant: 'destructive',
        })
        setFiles(valid.slice(0, MAX_FILES))
      } else {
        setFiles(valid)
      }
      setResult(null)
    }
  }

  const handleImport = async () => {
    if (files.length === 0) {
      toast({
        title: 'No files selected',
        description: 'Please select one or more Excel files to import',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const formData = new FormData()
      files.forEach((file) => formData.append('file', file))

      const result = await importTransactionsFromExcel(formData)
      setResult(result)

      if (result.success) {
        toast({
          title: 'Import Successful',
          description: `Created ${result.accountsCreated} accounts and ${result.transactionsCreated} transactions`,
        })
      } else {
        toast({
          title: 'Import Completed with Errors',
          description: result.message,
          variant: 'destructive',
        })
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to import transactions'
      setResult({
        success: false,
        message: errorMessage,
        accountsCreated: 0,
        transactionsCreated: 0,
        errors: [errorMessage],
      })
      toast({
        title: 'Import Failed',
        description: errorMessage,
        variant: 'destructive',
      })
    } finally {
      setLoading(false)
    }
  }

  const handleRecalculateBalances = async () => {
    setRecalcLoading(true)
    try {
      const { updated, errors } = await recalculateAccountBalances()
      if (errors.length > 0) {
        toast({
          title: 'Recalculated with Errors',
          description: `Updated ${updated} accounts. ${errors.length} error(s).`,
          variant: 'destructive',
        })
      } else {
        toast({
          title: 'Balances Recalculated',
          description: `Updated ${updated} account balances from transactions.`,
        })
      }
    } catch (err) {
      toast({
        title: 'Recalculation Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setRecalcLoading(false)
    }
  }

  const handleDeleteAll = async () => {
    if (!confirm('Delete ALL transactions and reset account balances? This cannot be undone.')) return
    setDeleteLoading(true)
    try {
      const { deleted, error } = await deleteAllTransactions()
      if (error) {
        toast({ title: 'Delete Failed', description: error, variant: 'destructive' })
      } else {
        toast({
          title: 'All Transactions Deleted',
          description: deleted > 0 ? `Deleted ${deleted} transaction(s). Balances reset.` : 'No transactions to delete.',
        })
        setResult(null)
      }
    } catch (err) {
      toast({
        title: 'Delete Failed',
        description: err instanceof Error ? err.message : 'Unknown error',
        variant: 'destructive',
      })
    } finally {
      setDeleteLoading(false)
    }
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Excel Files</CardTitle>
          <CardDescription>
            For a fresh import: 1) Delete all transactions below. 2) Select all 7 files (Transactions 1–6 + Transfers). 3) Import. 4) Recalculate Balances. Transfers file is used as lookup when Transactions files are present.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                type="file"
                accept=".xlsx,.xls"
                multiple
                onChange={handleFileChange}
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleImport}
              disabled={files.length === 0 || loading}
            >
              {loading ? (
                'Importing...'
              ) : (
                <>
                  <Upload className="mr-2 h-4 w-4" />
                  Import
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleRecalculateBalances}
              disabled={recalcLoading}
            >
              {recalcLoading ? 'Recalculating...' : (
                <>
                  <RefreshCw className="mr-2 h-4 w-4" />
                  Recalculate Balances
                </>
              )}
            </Button>
            <Button
              variant="outline"
              onClick={handleDeleteAll}
              disabled={deleteLoading}
              className="text-red-600 border-red-200 hover:bg-red-50 hover:border-red-300"
            >
              {deleteLoading ? 'Deleting...' : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Delete All Transactions
                </>
              )}
            </Button>
          </div>

          {files.length > 0 && (
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                {files.length} file{files.length !== 1 ? 's' : ''} selected:
              </p>
              <ul className="flex flex-wrap gap-2">
                {files.map((f, i) => (
                  <li
                    key={i}
                    className="flex items-center gap-2 text-sm text-muted-foreground bg-muted/50 rounded px-2 py-1"
                  >
                    <FileSpreadsheet className="h-4 w-4 shrink-0" />
                    <span>{f.name}</span>
                    <span className="text-xs">({(f.size / 1024).toFixed(2)} KB)</span>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {result && (
            <div
              className={`rounded-lg border p-4 ${
                result.success
                  ? 'border-green-200 bg-green-50'
                  : 'border-yellow-200 bg-yellow-50'
              }`}
            >
              <div className="flex items-start gap-3">
                {result.success ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600 mt-0.5" />
                ) : (
                  <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5" />
                )}
                <div className="flex-1">
                  <h3 className={`font-semibold ${result.success ? 'text-green-800' : 'text-yellow-800'}`}>
                    Import {result.success ? 'Successful' : 'Completed with Warnings'}
                  </h3>
                  <p className={`text-sm mt-1 ${result.success ? 'text-green-700' : 'text-yellow-700'}`}>
                    {result.message}
                  </p>
                  <div className="mt-2 space-y-1 text-sm">
                    <p className={result.success ? 'text-green-700' : 'text-yellow-700'}>
                      • Accounts created: {result.accountsCreated}
                    </p>
                    <p className={result.success ? 'text-green-700' : 'text-yellow-700'}>
                      • Transactions created: {result.transactionsCreated}
                    </p>
                  </div>
                  {result.errors.length > 0 && (
                    <div className="mt-3">
                      <p className="text-sm font-medium text-yellow-800 mb-1">Errors/Warnings:</p>
                      <ul className="list-disc list-inside text-xs text-yellow-700 space-y-1">
                        {result.errors.map((error, idx) => (
                          <li key={idx}>{error}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
















