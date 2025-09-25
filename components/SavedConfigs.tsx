import { useState, useEffect } from 'react'
import { SavedConfig } from '../types'
import { Download, Trash2 } from 'lucide-react'

export default function SavedConfigs() {
  const [configs, setConfigs] = useState<SavedConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/configs')
      const data = await response.json()
      
      // Check if we got an error response
      if (response.status !== 200 || data.error) {
        const errorMsg = data.error || 'Failed to fetch saved configurations'
        console.error('API Error:', errorMsg)
        setError(errorMsg)
        setConfigs([])
        return
      }
      
      // Ensure data is an array
      if (Array.isArray(data)) {
        setConfigs(data)
      } else {
        console.error('Expected array, got:', typeof data, data)
        setError('Invalid response format from server')
        setConfigs([])
      }
    } catch (error) {
      console.error('Failed to fetch configs:', error)
      setError('Failed to connect to server. Please check your connection.')
      setConfigs([])
    } finally {
      setLoading(false)
    }
  }

  const downloadConfig = async (config: SavedConfig) => {
    try {
      const response = await fetch('/api/generate-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config.config)
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${config.name}-sst-config.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      } else {
        console.error('Download failed:', response.statusText)
        alert('Failed to download configuration')
      }
    } catch (error) {
      console.error('Download failed:', error)
      alert('Failed to download configuration')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading saved configurations...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <div className="text-red-800 font-medium mb-2">Error Loading Configurations</div>
          <div className="text-red-600 text-sm mb-4">{error}</div>
          <button
            onClick={fetchConfigs}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  if (configs.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No saved configurations</h3>
        <p className="text-gray-600">Create and save your first SST configuration to see it here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Saved Configurations</h2>
      
      <div className="grid gap-4">
        {Array.isArray(configs) && configs.map((config) => (
          <div key={config.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{config.name}</h3>
                <p className="text-sm text-gray-600 mb-2">{config.repository}</p>
                
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {config.config.framework}
                  </span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                    {config.config.region}
                  </span>
                  {config.config.customDomain?.enabled && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                      Custom Domain
                    </span>
                  )}
                </div>
                
                <p className="text-xs text-gray-500 mt-2">
                  Created: {new Date(config.createdAt).toLocaleDateString()}
                </p>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => downloadConfig(config)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Download configuration"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
