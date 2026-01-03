'use client'

import { useState } from 'react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { useToast } from '@/components/ui/toaster'
import { Upload, FileSpreadsheet, AlertCircle, CheckCircle2 } from 'lucide-react'
import { importCustomersFromExcel } from '@/app/actions/customers-import'

export function ImportCustomers() {
  const { toast } = useToast()
  const [file, setFile] = useState<File | null>(null)
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<{
    success: boolean
    message: string
    customersCreated: number
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

      const result = await importCustomersFromExcel(formData)

      setResult(result)

      if (result.success) {
        toast({
          title: 'Success',
          description: result.message,
        })
      } else {
        toast({
          title: 'Import Completed with Warnings',
          description: result.message,
          variant: result.customersCreated > 0 ? 'default' : 'destructive',
        })
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: error instanceof Error ? error.message : 'Failed to import customers',
        variant: 'destructive',
      })
      setResult({
        success: false,
        message: error instanceof Error ? error.message : 'Failed to import customers',
        customersCreated: 0,
        errors: [error instanceof Error ? error.message : 'Unknown error'],
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
            Upload your customers Excel file. The file should contain columns: Name, Company, Email, Phone, Address
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            <Input
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFileChange}
              className="flex-1"
            />
            <Button onClick={handleImport} disabled={!file || loading}>
              <Upload className="mr-2 h-4 w-4" />
              {loading ? 'Importing...' : 'Import'}
            </Button>
          </div>
          {file && (
            <div className="text-sm text-muted-foreground">
              Selected: {file.name} ({(file.size / 1024).toFixed(2)} KB)
            </div>
          )}
        </CardContent>
      </Card>

      {result && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              {result.success ? (
                <CheckCircle2 className="h-5 w-5 text-green-500" />
              ) : (
                <AlertCircle className="h-5 w-5 text-yellow-500" />
              )}
              <CardTitle>
                {result.success ? 'Import Successful' : 'Import Completed with Warnings'}
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="font-medium">{result.message}</p>
              <p className="text-sm text-muted-foreground mt-2">
                • Customers created: {result.customersCreated}
              </p>
            </div>

            {result.errors.length > 0 && (
              <div>
                <p className="font-medium mb-2">
                  Errors/Warnings ({result.errors.length}):
                </p>
                <div className="max-h-64 overflow-y-auto space-y-1">
                  {result.errors.map((error, index) => (
                    <p key={index} className="text-sm text-muted-foreground">
                      • {error}
                    </p>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  )
}















