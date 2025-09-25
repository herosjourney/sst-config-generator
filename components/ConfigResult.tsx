import { useState } from 'react'
import { DeploymentConfig } from '../types'
import { Download, Save, Copy } from 'lucide-react'

interface ConfigResultProps {
  config: DeploymentConfig
  onSave?: (name: string) => void
}

export default function ConfigResult({ config, onSave }: ConfigResultProps) {
  const [saving, setSaving] = useState(false)
  const [configName, setConfigName] = useState(config.projectName)
  const [showSaveModal, setShowSaveModal] = useState(false)

  const downloadConfig = async () => {
    try {
      const response = await fetch('/api/generate-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${config.projectName}-sst-config.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const saveConfig = async () => {
    if (!onSave) return
    
    setSaving(true)
    try {
      await onSave(configName)
      setShowSaveModal(false)
    } catch (error) {
      console.error('Save failed:', error)
    } finally {
      setSaving(false)
    }
  }

  const copyInstructions = () => {
    const instructions = `# SST Deployment Instructions

## Prerequisites
1. Install SST: npm install -g sst
2. Configure AWS CLI with your credentials
3. Ensure you have the necessary AWS permissions

## Setup Steps
1. Extract the downloaded files to your project root
2. Install dependencies: npm install
3. Deploy to AWS: sst deploy --stage production

## Your Configuration
- Project: ${config.projectName}
- Type: ${config.projectType}
- Framework: ${config.framework}
- Region: ${config.region}
- Custom Domain: ${config.customDomain?.enabled ? config.customDomain.domain : 'No'}
- Performance: ${config.performance}
- User Distribution: ${config.userDistribution}
`
    navigator.clipboard.writeText(instructions)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">✓</span>
          </div>
          <h2 className="text-xl font-bold text-green-800">SST Configuration Generated!</h2>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Configuration Summary</h3>
            <ul className="space-y-1 text-sm">
              <li><span className="font-medium">Project:</span> {config.projectName}</li>
              <li><span className="font-medium">Type:</span> {config.projectType}</li>
              <li><span className="font-medium">Framework:</span> {config.framework}</li>
              <li><span className="font-medium">Region:</span> {config.region}</li>
              <li><span className="font-medium">Custom Domain:</span> {config.customDomain?.enabled ? config.customDomain.domain : 'No'}</li>
              <li><span className="font-medium">Performance:</span> {config.performance}</li>
              <li><span className="font-medium">User Distribution:</span> {config.userDistribution}</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">What's Included</h3>
            <ul className="space-y-1 text-sm">
              <li>• sst.config.ts (main configuration)</li>
              <li>• Updated package.json with SST dependencies</li>
              <li>• Step-by-step deployment instructions</li>
              <li>• AWS resource configuration</li>
              {config.customDomain?.enabled && <li>• Domain and SSL setup</li>}
              {config.userDistribution === 'worldwide' && <li>• CloudFront CDN configuration</li>}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={downloadConfig}
          className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          <Download size={20} />
          <span>Download Configuration</span>
        </button>
        
        {onSave && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium"
          >
            <Save size={20} />
            <span>Save Configuration</span>
          </button>
        )}
        
        <button
          onClick={copyInstructions}
          className="flex items-center space-x-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium"
        >
          <Copy size={20} />
          <span>Copy Instructions</span>
        </button>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Save Configuration</h3>
            <input
              type="text"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              placeholder="Configuration name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex space-x-3">
              <button
                onClick={saveConfig}
                disabled={saving || !configName.trim()}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
