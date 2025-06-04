'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Upload, FileText, Send } from 'lucide-react'
import { Button } from '@/components/ui/button'
import Papa from 'papaparse'
import toast from 'react-hot-toast'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'

const REQUIRED_COLUMNS = ['name', 'email', 'balance', 'state']

function UploadContent() {
  const [currentStep, setCurrentStep] = useState(1)
  const [file, setFile] = useState(null)
  const [csvData, setCsvData] = useState([])
  const [validationErrors, setValidationErrors] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  const router = useRouter()

  const validateRow = (row, index) => {
    const errors = []
    
    if (!row.name || row.name.trim().length < 2) {
      errors.push(`Row ${index + 1}: Name must be at least 2 characters`)
    }
    
    if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
      errors.push(`Row ${index + 1}: Invalid email address`)
    }
    
    const balance = parseFloat(row.balance)
    if (isNaN(balance) || balance <= 0) {
      errors.push(`Row ${index + 1}: Balance must be a positive number`)
    }
    
    if (!row.state || row.state.trim().length !== 2) {
      errors.push(`Row ${index + 1}: State must be 2 letters (e.g., CA, NY)`)
    }
    
    return errors
  }

  const handleFileUpload = (selectedFile) => {
    setFile(selectedFile)
    
    Papa.parse(selectedFile, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        const { data, errors: parseErrors } = results
        
        if (parseErrors.length > 0) {
          toast.error('Error parsing CSV file')
          return
        }

        // Check required columns
        const headers = Object.keys(data[0] || {})
        const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col))
        
        if (missingColumns.length > 0) {
          toast.error(`Missing required columns: ${missingColumns.join(', ')}`)
          return
        }

        // Validate all rows
        const allErrors = []
        data.forEach((row, index) => {
          const rowErrors = validateRow(row, index)
          allErrors.push(...rowErrors)
        })

        setCsvData(data)
        setValidationErrors(allErrors)
        setCurrentStep(2)
        
        if (allErrors.length === 0) {
          toast.success(`${data.length} rows loaded successfully`)
        } else {
          toast.error(`${allErrors.length} validation errors found`)
        }
      },
      error: (error) => {
        toast.error('Failed to parse CSV file')
        console.error('Parse error:', error)
      }
    })
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const droppedFile = e.dataTransfer.files[0]
    if (droppedFile && droppedFile.type === 'text/csv') {
      handleFileUpload(droppedFile)
    } else {
      toast.error('Please upload a CSV file')
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
  }

  const sendLetters = async () => {
    if (validationErrors.length > 0) {
      toast.error('Please fix validation errors before sending')
      return
    }

    setIsUploading(true)
    
    try {
      const response = await fetch('/api/process-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: csvData }),
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`${result.processed} letters queued and sent!`)
        setCurrentStep(3)
        setTimeout(() => {
          router.push('/dashboard')
        }, 2000)
      } else {
        const error = await response.json()
        toast.error(error.message || 'Failed to process CSV')
      }
    } catch (error) {
      toast.error('Network error. Please try again.')
      console.error('Upload error:', error)
    } finally {
      setIsUploading(false)
    }
  }

  const downloadSample = () => {
    const sampleData = [
      { name: 'John Smith', email: 'john@example.com', balance: '1250.00', state: 'CA' },
      { name: 'Jane Doe', email: 'jane@example.com', balance: '890.50', state: 'NY' },
      { name: 'Bob Johnson', email: 'bob@example.com', balance: '2100.75', state: 'TX' },
    ]
    
    const csv = Papa.unparse(sampleData)
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'sample-debtors.csv'
    a.click()
    window.URL.revokeObjectURL(url)
  }

  return (
    <div className="p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Upload Debtor Data</h1>
          <p className="mt-2 text-gray-600">Upload a CSV file to generate and send demand letters</p>
        </div>

        {/* Step indicator */}
        <div className="mb-8">
          <div className="flex items-center">
            {[
              { step: 1, title: 'Upload', icon: Upload },
              { step: 2, title: 'Review', icon: FileText },
              { step: 3, title: 'Send', icon: Send },
            ].map(({ step, title, icon: Icon }, index) => (
              <div key={step} className="flex items-center">
                <div className={`flex items-center justify-center w-10 h-10 rounded-full border-2 ${
                  currentStep >= step 
                    ? 'bg-blue-600 border-blue-600 text-white' 
                    : 'border-gray-300 text-gray-500'
                }`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className={`ml-3 text-sm font-medium ${
                  currentStep >= step ? 'text-blue-600' : 'text-gray-500'
                }`}>
                  {title}
                </span>
                {index < 2 && (
                  <div className={`w-16 h-0.5 mx-4 ${
                    currentStep > step ? 'bg-blue-600' : 'bg-gray-300'
                  }`} />
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Step 1: File Upload */}
        {currentStep === 1 && (
          <div className="space-y-6">
            <div
              className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center hover:border-gray-400 transition-colors"
              onDrop={handleDrop}
              onDragOver={handleDragOver}
            >
              <Upload className="w-16 h-16 text-gray-400 mx-auto mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                Drop your CSV file here, or click to browse
              </h3>
              <p className="text-gray-600 mb-4">
                Supports CSV files up to 10MB
              </p>
              <input
                type="file"
                accept=".csv"
                onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
                className="hidden"
                id="file-upload"
              />
              <label
                htmlFor="file-upload"
                className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
              >
                Select File
              </label>
            </div>

            <div className="bg-blue-50 p-6 rounded-lg">
              <h3 className="text-lg font-medium text-blue-900 mb-3">CSV Requirements</h3>
              <div className="text-sm text-blue-800 space-y-2">
                <p><strong>Required columns:</strong> name, email, balance, state</p>
                <p><strong>Format:</strong> Standard CSV with headers in the first row</p>
                <p><strong>Balance:</strong> Enter as decimal number (e.g., 1250.00)</p>
                <p><strong>State:</strong> Use 2-letter state codes (e.g., CA, NY, TX)</p>
              </div>
              <Button 
                onClick={downloadSample} 
                variant="outline" 
                className="mt-4 text-blue-700 border-blue-300 hover:bg-blue-100"
              >
                Download Sample CSV
              </Button>
            </div>
          </div>
        )}

        {/* Step 2: Review */}
        {currentStep === 2 && (
          <div className="space-y-6">
            <div className="bg-white rounded-lg shadow overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Data Validation Results</h3>
              </div>
              
              <div className="p-6">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                  <div className="bg-green-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-green-600">
                      {csvData.length - validationErrors.length}
                    </div>
                    <div className="text-sm text-green-800">Valid Records</div>
                  </div>
                  
                  <div className="bg-red-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-red-600">
                      {validationErrors.length}
                    </div>
                    <div className="text-sm text-red-800">Validation Errors</div>
                  </div>
                  
                  <div className="bg-blue-50 p-4 rounded-lg text-center">
                    <div className="text-2xl font-bold text-blue-600">
                      {csvData.length}
                    </div>
                    <div className="text-sm text-blue-800">Total Records</div>
                  </div>
                </div>

                {validationErrors.length > 0 && (
                  <div className="mb-6">
                    <h4 className="text-md font-medium text-red-900 mb-3">Validation Errors</h4>
                    <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-64 overflow-y-auto">
                      <div className="space-y-1">
                        {validationErrors.map((error, index) => (
                          <div key={index} className="text-sm text-red-700">
                            {error}
                          </div>
                        ))}
                      </div>
                    </div>
                    <p className="text-sm text-red-600 mt-2">
                      Please fix these errors in your CSV file and re-upload.
                    </p>
                  </div>
                )}

                {csvData.length > 0 && (
                  <div>
                    <h4 className="text-md font-medium text-gray-900 mb-3">Sample Data Preview</h4>
                    <div className="overflow-x-auto border border-gray-200 rounded-lg">
                      <table className="min-w-full divide-y divide-gray-200">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Balance</th>
                            <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">State</th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {csvData.slice(0, 5).map((row, index) => (
                            <tr key={index}>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.name}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.email}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">${row.balance}</td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{row.state}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    {csvData.length > 5 && (
                      <p className="text-sm text-gray-500 mt-2">
                        Showing first 5 of {csvData.length} records
                      </p>
                    )}
                  </div>
                )}
              </div>
              
              <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 flex justify-between">
                <Button 
                  variant="outline" 
                  onClick={() => setCurrentStep(1)}
                >
                  Back
                </Button>
                <Button 
                  onClick={sendLetters}
                  disabled={validationErrors.length > 0 || isUploading}
                  className="flex items-center gap-2"
                >
                  {isUploading ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      Processing...
                    </>
                  ) : (
                    <>
                      <Send className="w-4 h-4" />
                      Generate & Send Letters
                    </>
                  )}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Success */}
        {currentStep === 3 && (
          <div className="text-center py-12">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-green-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Letters Generated Successfully!</h3>
            <p className="text-gray-600 mb-6">
              Your demand letters have been generated and queued for sending.
            </p>
            <div className="space-x-4">
              <Button onClick={() => router.push('/dashboard')}>
                View Dashboard
              </Button>
              <Button 
                variant="outline" 
                onClick={() => {
                  setCurrentStep(1)
                  setFile(null)
                  setCsvData([])
                  setValidationErrors([])
                }}
              >
                Upload Another File
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function UploadPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <UploadContent />
      </AppLayout>
    </ProtectedRoute>
  )
} 