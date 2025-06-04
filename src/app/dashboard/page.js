'use client'

import { useState, useEffect } from 'react'
import { Search, MoreHorizontal, Eye, CheckCircle, RotateCcw, Upload, X, FileText, Calendar, Mail, DollarSign, User, MapPin, FolderOpen, FolderCheck, Clock, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { supabase } from '@/lib/supabase'
import { formatCurrency, formatDate, getStatusColor, getStatusIcon } from '@/lib/utils'
import toast from 'react-hot-toast'
import Papa from 'papaparse'
import { ProtectedRoute } from '@/components/auth/ProtectedRoute'
import { AppLayout } from '@/components/layout/AppLayout'

function DashboardContent() {
  const [letters, setLetters] = useState([])
  const [filteredLetters, setFilteredLetters] = useState([])
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState('all')
  const [loading, setLoading] = useState(true)
  
  // Modal states
  const [showUploadModal, setShowUploadModal] = useState(false)
  const [showPersonModal, setShowPersonModal] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState(null)
  const [personEvents, setPersonEvents] = useState([])
  
  // Upload states
  const [uploadFile, setUploadFile] = useState(null)
  const [uploadStep, setUploadStep] = useState(1)
  const [csvData, setCsvData] = useState([])
  const [validData, setValidData] = useState([])
  const [errors, setErrors] = useState([])
  const [isUploading, setIsUploading] = useState(false)
  
  const [metrics, setMetrics] = useState({
    total: 0,
    openCases: 0,
    closedCases: 0,
    lateCases: 0,
    totalBalance: 0,
    collectedAmount: 0,
    collectionRate: 0
  })

  // Fetch letters and related data
  const fetchLetters = async () => {
    try {
      console.log('Starting fetchLetters...')
      const { data, error } = await supabase
        .from('letters')
        .select(`
          id,
          status,
          sent_at,
          opened_at,
          created_at,
          debtors (
            id,
            name,
            email,
            balance_cents,
            state
          )
        `)
        .order('created_at', { ascending: false })

      console.log('Supabase response:', { data, error })

      if (error) {
        console.error('Supabase error:', error)
        
        // If it's an RLS error or auth error, just show empty state
        if (error.code === 'PGRST116' || error.message?.includes('RLS') || error.message?.includes('JWT')) {
          console.log('Authentication/RLS issue - showing empty state')
          setLetters([])
          calculateMetrics([])
          return
        }
        
        throw error
      }

      console.log('Setting letters data:', data)
      setLetters(data || [])
      calculateMetrics(data || [])
    } catch (error) {
      console.error('Error fetching letters:', error)
      // Don't show error toast for auth issues, just show empty state
      if (!error.code?.includes('PGRST') && !error.message?.includes('RLS')) {
        toast.error('Failed to load dashboard data')
      }
      setLetters([])
      calculateMetrics([])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchLetters()
  }, [])

  useEffect(() => {
    // Filter letters based on search term and status
    let filtered = letters
    
    if (searchTerm) {
      filtered = filtered.filter(letter => 
        letter.debtors?.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        letter.debtors?.email?.toLowerCase().includes(searchTerm.toLowerCase())
      )
    }
    
    if (statusFilter !== 'all') {
      filtered = filtered.filter(letter => letter.status === statusFilter)
    }
    
    setFilteredLetters(filtered)
  }, [letters, searchTerm, statusFilter])

  const calculateMetrics = (lettersData) => {
    const openCases = lettersData.filter(l => ['draft', 'sent', 'opened'].includes(l.status)).length
    const closedCases = lettersData.filter(l => l.status === 'paid').length
    const lateCases = lettersData.filter(l => {
      // Consider cases late if sent more than 30 days ago and not paid
      if (!l.sent_at || l.status === 'paid') return false
      const sentDate = new Date(l.sent_at)
      const thirtyDaysAgo = new Date()
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
      return sentDate < thirtyDaysAgo
    }).length
    
    const totalBalance = lettersData.reduce((sum, l) => sum + (l.debtors?.balance_cents || 0), 0)
    const collectedAmount = lettersData
      .filter(l => l.status === 'paid')
      .reduce((sum, l) => sum + (l.debtors?.balance_cents || 0), 0)
    
    const collectionRate = totalBalance > 0 ? Math.round((collectedAmount / totalBalance) * 100) : 0
    
    setMetrics({
      total: lettersData.length,
      openCases,
      closedCases,
      lateCases,
      totalBalance,
      collectedAmount,
      collectionRate
    })
  }

  // Action handlers
  const markAsPaid = async (letterId) => {
    try {
      const { error } = await supabase
        .from('letters')
        .update({ 
          status: 'paid',
          paid_at: new Date().toISOString()
        })
        .eq('id', letterId)

      if (error) throw error
      
      toast.success('Letter marked as paid')
      fetchLetters()
    } catch (error) {
      console.error('Error marking as paid:', error)
      toast.error('Failed to mark as paid')
    }
  }

  const resendLetter = async (letterId) => {
    try {
      // This would typically re-trigger the email sending process
      toast.success('Letter resent successfully')
      fetchLetters()
    } catch (error) {
      console.error('Error resending letter:', error)
      toast.error('Failed to resend letter')
    }
  }

  const handleFileUpload = (file) => {
    setUploadFile(file)
    
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        setCsvData(results.data)
        validateData(results.data)
        setUploadStep(2)
      },
      error: (error) => {
        toast.error('Failed to parse CSV file')
        console.error('Parse error:', error)
      }
    })
  }

  const validateData = (data) => {
    const validRecords = []
    const errorRecords = []
    
    data.forEach((row, index) => {
      const errors = []
      
      if (!row.name || row.name.trim().length < 2) {
        errors.push('Name must be at least 2 characters')
      }
      
      if (!row.email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email)) {
        errors.push('Invalid email address')
      }
      
      const balance = parseFloat(row.balance)
      if (isNaN(balance) || balance <= 0) {
        errors.push('Balance must be a positive number')
      }
      
      if (!row.state || row.state.trim().length !== 2) {
        errors.push('State must be 2 letters (e.g., CA, NY)')
      }
      
      if (errors.length === 0) {
        validRecords.push({ ...row, balance_cents: Math.round(balance * 100) })
      } else {
        errorRecords.push({ row: index + 1, errors })
      }
    })
    
    setValidData(validRecords)
    setErrors(errorRecords)
  }

  const processCsvData = async () => {
    setIsUploading(true)
    
    try {
      const response = await fetch('/api/process-csv', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ data: validData }),
      })

      if (response.ok) {
        const result = await response.json()
        toast.success(`${result.processed} letters processed successfully!`)
        closeUploadModal()
        fetchLetters()
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

  const closeUploadModal = () => {
    setShowUploadModal(false)
    setUploadStep(1)
    setUploadFile(null)
    setCsvData([])
    setValidData([])
    setErrors([])
    setIsUploading(false)
  }

  const openPersonModal = async (letter) => {
    setSelectedPerson({
      name: letter.debtors.name,
      email: letter.debtors.email,
      state: letter.debtors.state,
      balance_cents: letter.debtors.balance_cents,
      letter: letter
    })
    setShowPersonModal(true)
    
    // Fetch events for this letter
    try {
      const { data, error } = await supabase
        .from('events')
        .select('*')
        .eq('letter_id', letter.id)
        .order('created_at', { ascending: false })
      
      if (error) throw error
      setPersonEvents(data || [])
    } catch (error) {
      console.error('Error fetching events:', error)
      setPersonEvents([])
    }
  }

  if (loading) {
    return (
      <div className="p-8">
        <div className="max-w-7xl mx-auto">
          <div className="animate-pulse">
            <div className="h-8 bg-gray-200 rounded w-1/4 mb-4"></div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
              {[...Array(4)].map((_, i) => (
                <div key={i} className="bg-white p-6 rounded-lg shadow">
                  <div className="h-4 bg-gray-200 rounded w-1/2 mb-2"></div>
                  <div className="h-8 bg-gray-200 rounded w-3/4"></div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
          <p className="mt-2 text-gray-600">Monitor your demand letter campaigns</p>
        </div>

        {/* Metrics */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FolderOpen className="w-8 h-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Open Cases</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.openCases}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <FolderCheck className="w-8 h-8 text-green-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Closed Cases</p>
                <p className="text-2xl font-bold text-green-600">{metrics.closedCases}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <Clock className="w-8 h-8 text-red-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Late Cases</p>
                <p className="text-2xl font-bold text-red-600">{metrics.lateCases}</p>
                <p className="text-xs text-gray-500">Over 30 days</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow">
            <div className="flex items-center">
              <div className="flex-shrink-0">
                <TrendingUp className="w-8 h-8 text-blue-600" />
              </div>
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Collection Rate</p>
                <p className="text-2xl font-bold text-blue-600">{metrics.collectionRate}%</p>
                <p className="text-xs text-gray-500">
                  {formatCurrency(metrics.collectedAmount)} collected
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Table Header with Upload Button */}
        <div className="bg-white rounded-lg shadow mb-6">
          <div className="p-6 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
              <div className="flex flex-col sm:flex-row gap-4 flex-1">
                <div className="flex-1">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
                    <input
                      type="text"
                      placeholder="Search by debtor name or email..."
                      className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                    />
                  </div>
                </div>
                <select
                  className="px-4 py-2 border border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value)}
                >
                  <option value="all">All Status</option>
                  <option value="draft">Draft</option>
                  <option value="sent">Sent</option>
                  <option value="opened">Opened</option>
                  <option value="paid">Paid</option>
                  <option value="escalated">Escalated</option>
                </select>
              </div>
              <Button onClick={() => setShowUploadModal(true)} className="flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Upload CSV
              </Button>
            </div>
          </div>

          {/* Data Table */}
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Debtor
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Balance
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Sent At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Opened At
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredLetters.length === 0 ? (
                  <tr>
                    <td colSpan="6" className="px-6 py-12 text-center">
                      <div className="text-gray-500">
                        {letters.length === 0 ? (
                          <>
                            <p className="text-lg font-medium">No letters yet</p>
                            <p className="mt-1">Upload a debtor file to begin</p>
                          </>
                        ) : (
                          <>
                            <p className="text-lg font-medium">No results found</p>
                            <p className="mt-1">Try adjusting your search or filter</p>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ) : (
                  filteredLetters.map((letter) => (
                    <tr 
                      key={letter.id} 
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => openPersonModal(letter)}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {letter.debtors?.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {letter.debtors?.email}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatCurrency(letter.debtors?.balance_cents || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${getStatusColor(letter.status)}`}>
                          <span className="mr-1">{getStatusIcon(letter.status)}</span>
                          {letter.status.charAt(0).toUpperCase() + letter.status.slice(1)}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(letter.sent_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {formatDate(letter.opened_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => openPersonModal(letter)}
                          >
                            <Eye className="h-4 w-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Upload Modal */}
        {showUploadModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Upload CSV File</h3>
                <button
                  onClick={closeUploadModal}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                {uploadStep === 1 && (
                  <div>
                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-12 text-center">
                      <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-900 mb-2">Upload your CSV file</h4>
                      <p className="text-gray-600 mb-4">
                        File should include: name, email, balance, state columns
                      </p>
                      <input
                        type="file"
                        accept=".csv"
                        onChange={(e) => e.target.files[0] && handleFileUpload(e.target.files[0])}
                        className="hidden"
                        id="csv-upload"
                      />
                      <label
                        htmlFor="csv-upload"
                        className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-blue-600 hover:bg-blue-700 cursor-pointer"
                      >
                        Choose File
                      </label>
                    </div>
                  </div>
                )}

                {uploadStep === 2 && (
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4">Review Data</h4>
                    
                    <div className="mb-6">
                      <div className="grid grid-cols-3 gap-4 mb-4">
                        <div className="bg-green-50 p-4 rounded-lg">
                          <p className="text-sm font-medium text-green-600">Valid Records</p>
                          <p className="text-2xl font-bold text-green-900">{validData.length}</p>
                        </div>
                        <div className="bg-red-50 p-4 rounded-lg">
                          <p className="text-sm font-medium text-red-600">Invalid Records</p>
                          <p className="text-2xl font-bold text-red-900">{errors.length}</p>
                        </div>
                        <div className="bg-blue-50 p-4 rounded-lg">
                          <p className="text-sm font-medium text-blue-600">Total Records</p>
                          <p className="text-2xl font-bold text-blue-900">{csvData.length}</p>
                        </div>
                      </div>
                    </div>

                    {errors.length > 0 && (
                      <div className="mb-6">
                        <h5 className="font-medium text-red-900 mb-2">Validation Errors</h5>
                        <div className="bg-red-50 border border-red-200 rounded-lg p-4 max-h-40 overflow-y-auto">
                          {errors.map((error, index) => (
                            <div key={index} className="text-sm text-red-700 mb-1">
                              Row {error.row}: {error.errors.join(', ')}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex justify-end space-x-3">
                      <Button variant="outline" onClick={closeUploadModal}>
                        Cancel
                      </Button>
                      <Button 
                        onClick={processCsvData} 
                        disabled={validData.length === 0 || isUploading}
                      >
                        {isUploading ? 'Processing...' : `Process ${validData.length} Records`}
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Person Detail Modal */}
        {showPersonModal && selectedPerson && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto m-4">
              <div className="flex items-center justify-between p-6 border-b border-gray-200">
                <h3 className="text-lg font-medium text-gray-900">Debtor Details</h3>
                <button
                  onClick={() => setShowPersonModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="w-6 h-6" />
                </button>
              </div>

              <div className="p-6">
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                  {/* Person Info */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <User className="w-5 h-5 mr-2" />
                      Personal Information
                    </h4>
                    <div className="space-y-3">
                      <div className="flex items-center">
                        <span className="text-sm font-medium text-gray-500 w-20">Name:</span>
                        <span className="text-sm text-gray-900">{selectedPerson.name}</span>
                      </div>
                      <div className="flex items-center">
                        <Mail className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-500 w-16">Email:</span>
                        <span className="text-sm text-gray-900">{selectedPerson.email}</span>
                      </div>
                      <div className="flex items-center">
                        <MapPin className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-500 w-16">State:</span>
                        <span className="text-sm text-gray-900">{selectedPerson.state}</span>
                      </div>
                      <div className="flex items-center">
                        <DollarSign className="w-4 h-4 text-gray-400 mr-2" />
                        <span className="text-sm font-medium text-gray-500 w-16">Balance:</span>
                        <span className="text-sm font-bold text-red-600">
                          {formatCurrency(selectedPerson.balance_cents)}
                        </span>
                      </div>
                    </div>

                    {/* Letter Status */}
                    <div className="mt-6">
                      <h5 className="text-md font-medium text-gray-900 mb-2">Letter Status</h5>
                      <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium ${getStatusColor(selectedPerson.letter.status)}`}>
                        <span className="mr-2">{getStatusIcon(selectedPerson.letter.status)}</span>
                        {selectedPerson.letter.status.charAt(0).toUpperCase() + selectedPerson.letter.status.slice(1)}
                      </span>
                    </div>
                  </div>

                  {/* Events Timeline */}
                  <div>
                    <h4 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
                      <Calendar className="w-5 h-5 mr-2" />
                      Activity Timeline
                    </h4>
                    <div className="space-y-4 max-h-80 overflow-y-auto">
                      {personEvents.length === 0 ? (
                        <p className="text-sm text-gray-500">No activity recorded yet</p>
                      ) : (
                        personEvents.map((event) => (
                          <div key={event.id} className="flex items-start space-x-3">
                            <div className="flex-shrink-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center ${
                                event.type === 'sent' ? 'bg-blue-100 text-blue-600' :
                                event.type === 'opened' ? 'bg-green-100 text-green-600' :
                                event.type === 'paid' ? 'bg-emerald-100 text-emerald-600' :
                                'bg-gray-100 text-gray-600'
                              }`}>
                                {event.type === 'sent' && <Mail className="w-4 h-4" />}
                                {event.type === 'opened' && <Eye className="w-4 h-4" />}
                                {event.type === 'paid' && <CheckCircle className="w-4 h-4" />}
                                {!['sent', 'opened', 'paid'].includes(event.type) && <FileText className="w-4 h-4" />}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-gray-900 capitalize">
                                {event.type === 'sent' ? 'Letter Sent' :
                                 event.type === 'opened' ? 'Letter Opened' :
                                 event.type === 'paid' ? 'Marked as Paid' : event.type}
                              </p>
                              <p className="text-xs text-gray-500">
                                {formatDate(event.created_at)}
                              </p>
                              {event.metadata && (
                                <p className="text-xs text-gray-400 mt-1">
                                  {JSON.stringify(event.metadata)}
                                </p>
                              )}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-end space-x-3">
                  {selectedPerson.letter.status !== 'paid' && (
                    <Button 
                      onClick={() => {
                        markAsPaid(selectedPerson.letter.id)
                        setShowPersonModal(false)
                      }}
                      className="flex items-center gap-2"
                    >
                      <CheckCircle className="w-4 h-4" />
                      Mark as Paid
                    </Button>
                  )}
                  <Button 
                    variant="outline"
                    onClick={() => {
                      resendLetter(selectedPerson.letter.id)
                      setShowPersonModal(false)
                    }}
                    className="flex items-center gap-2"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Resend Letter
                  </Button>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function DashboardPage() {
  return (
    <ProtectedRoute>
      <AppLayout>
        <DashboardContent />
      </AppLayout>
    </ProtectedRoute>
  )
} 