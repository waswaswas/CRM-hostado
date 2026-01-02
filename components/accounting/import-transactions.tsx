'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toaster'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react'
import { importTransactionsFromExcel } from '@/app/actions/transactions-import'

export function ImportTransactions() {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    accountsCreated: number
    transactionsCreated: number
    errors: string[]
  } | null>(null)

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      if (selectedFile.name.endsWith('.xlsx') || selectedFile.name.endsWith('.xls')) {
        setFile(selectedFile)
        setResult(null)
      } else {
        toast({
          title: 'Invalid file type',
          description: 'Please select an Excel file (.xlsx or .xls)',
          variant: 'destructive',
        })
      }
    }
  }

  const handleImport = async () => {
    if (!file) {
      toast({
        title: 'No file selected',
        description: 'Please select an Excel file to import',
        variant: 'destructive',
      })
      return
    }

    setLoading(true)
    setResult(null)

    try {
      const formData = new FormData()
      formData.append('file', file)

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

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Upload Excel File</CardTitle>
          <CardDescription>
            Upload your transactions Excel file. The file should contain columns: Date, Number, Type, Category, Account, Contact, Document, Amount
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="flex-1">
              <Input
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFileChange}
                disabled={loading}
              />
            </div>
            <Button
              onClick={handleImport}
              disabled={!file || loading}
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
          </div>

          {file && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <FileSpreadsheet className="h-4 w-4" />
              <span>{file.name}</span>
              <span className="text-xs">({(file.size / 1024).toFixed(2)} KB)</span>
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











