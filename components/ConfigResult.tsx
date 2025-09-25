import { useState } from 'react'
import { DeploymentConfig, Repository } from '../types'
import { Download, Save, Copy, Zap, Terminal, CheckCircle, XCircle, Loader } from 'lucide-react'

interface ConfigResultProps {
  config: DeploymentConfig
  repository?: Repository
  onSave?: (name: string) => void
}

export default function ConfigResult({ config, repository, onSave }: ConfigResultProps) {
  const [saving, setSaving] = useState(false)
  const [configName, setConfigName] = useState(config.projectName)
  const [showSaveModal, setShowSaveModal] = useState(false)
  
  // Phase 1: Direct deployment state
  const [deploymentState, setDeploymentState] = useState<{
    status: 'idle' | 'deploying' | 'success' | 'error'
    progress: number
    currentStep: string
    logs: string[]
    deploymentUrl?: string
    error?: string
  }>({
    status: 'idle',
    progress: 0,
    currentStep: '',
    logs: [],
  })

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

  const downloadDeployScript = async () => {
    if (!repository) {
      alert('Repository information not available for one-click deploy')
      return
    }

    try {
      const response = await fetch('/api/generate-deploy-script', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ repository, config })
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `deploy-${config.projectName}.js`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Deploy script download failed:', error)
    }
  }

  // Phase 1: Direct deployment with progress feedback
  const deployDirectly = async () => {
    if (!repository) {
      alert('Repository information not available')
      return
    }

    setDeploymentState({
      status: 'deploying',
      progress: 0,
      currentStep: 'Starting deployment...',
      logs: ['🚀 Direct deployment initiated...'],
    })

    try {
      const response = await fetch('/api/deploy-direct', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          repository,
          config,
          progressCallback: true // Enable server-sent events
        })
      })

      if (!response.ok) {
        throw new Error('Deployment failed to start')
      }

      // Handle server-sent events for progress updates
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()

      if (reader) {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          const chunk = decoder.decode(value)
          const lines = chunk.split('\n')

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6))
                setDeploymentState(prev => ({
                  ...prev,
                  progress: data.progress || prev.progress,
                  currentStep: data.step || prev.currentStep,
                  logs: [...prev.logs, data.message],
                  deploymentUrl: data.deploymentUrl || prev.deploymentUrl,
                }))
              } catch (e) {
                // Ignore malformed JSON
              }
            }
          }
        }
      }

      setDeploymentState(prev => ({
        ...prev,
        status: 'success',
        progress: 100,
        currentStep: 'Deployment complete!',
      }))

    } catch (error) {
      setDeploymentState(prev => ({
        ...prev,
        status: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
        currentStep: 'Deployment failed',
      }))
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

## Quick Deploy Options:
1. Use "Deploy Now" button for instant deployment
2. Download deploy script for local deployment  
3. Download config files for manual setup

## Manual Setup:
1. Extract the downloaded files to your project root
2. Install dependencies: npm install
3. Deploy to AWS: sst deploy --stage production

## Your Configuration:
- Project: ${config.projectName}
- Framework: ${config.framework}
- Distribution: ${config.userDistribution}
- Custom Domain: ${config.customDomain?.enabled ? config.customDomain.domain : 'No'}
`
    navigator.clipboard.writeText(instructions)
  }

  // Show deployment progress modal
  if (deploymentState.status !== 'idle') {
    return (
      <div className="max-w-4xl mx-auto space-y-6">
        <div className={`border rounded-xl p-6 ${
          deploymentState.status === 'success' ? 'bg-green-50 border-green-200' :
          deploymentState.status === 'error' ? 'bg-red-50 border-red-200' :
          'bg-blue-50 border-blue-200'
        }`}>
          <div className="flex items-center space-x-3 mb-6">
            {deploymentState.status === 'deploying' && <Loader className="w-8 h-8 animate-spin text-blue-600" />}
            {deploymentState.status === 'success' && <CheckCircle className="w-8 h-8 text-green-600" />}
            {deploymentState.status === 'error' && <XCircle className="w-8 h-8 text-red-600" />}
            
            <div>
              <h3 className="text-xl font-bold">
                {deploymentState.status === 'deploying' && 'Deploying to AWS...'}
                {deploymentState.status === 'success' && '🎉 Deployment Successful!'}
                {deploymentState.status === 'error' && '❌ Deployment Failed'}
              </h3>
              <p className="text-sm opacity-80">{deploymentState.currentStep}</p>
            </div>
          </div>

          {/* Progress Bar */}
          <div className="mb-6">
            <div className="flex justify-between text-sm mb-2">
              <span>Progress</span>
              <span>{deploymentState.progress}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-3">
              <div 
                className="bg-blue-600 h-3 rounded-full transition-all duration-300"
                style={{ width: `${deploymentState.progress}%` }}
              />
            </div>
          </div>

          {/* Deployment URL */}
          {deploymentState.deploymentUrl && (
            <div className="mb-4 p-4 bg-white rounded-lg border">
              <div className="flex items-center justify-between">
                <span className="font-medium">🚀 Your app is live!</span>
                <a 
                  href={deploymentState.deploymentUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center space-x-2 bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <span>Visit Site</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </a>
              </div>
              <div className="text-sm text-gray-600 mt-2 break-all">
                {deploymentState.deploymentUrl}
              </div>
            </div>
          )}

          {/* Error Message */}
          {deploymentState.error && (
            <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-lg">
              <div className="font-medium text-red-800 mb-2">Error Details:</div>
              <div className="text-sm text-red-700">{deploymentState.error}</div>
            </div>
          )}

          {/* Live Logs */}
          <div className="space-y-2">
            <div className="text-sm font-medium">Deployment Log:</div>
            <div className="bg-gray-900 text-green-400 rounded-lg p-4 font-mono text-sm max-h-48 overflow-y-auto">
              {deploymentState.logs.map((log, index) => (
                <div key={index} className="mb-1">{log}</div>
              ))}
              {deploymentState.status === 'deploying' && (
                <div className="flex items-center space-x-2">
                  <div className="animate-spin w-3 h-3 border border-green-400 border-t-transparent rounded-full"></div>
                  <span>Processing...</span>
                </div>
              )}
            </div>
          </div>

          {/* Actions */}
          <div className="mt-6 flex space-x-4">
            {deploymentState.status === 'success' && (
              <button
                onClick={() => setDeploymentState({ status: 'idle', progress: 0, currentStep: '', logs: [] })}
                className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700"
              >
                Deploy Another Project
              </button>
            )}
            
            {deploymentState.status === 'error' && (
              <>
                <button
                  onClick={() => deployDirectly()}
                  className="bg-red-600 text-white px-6 py-2 rounded-lg hover:bg-red-700"
                >
                  Retry Deployment
                </button>
                <button
                  onClick={() => setDeploymentState({ status: 'idle', progress: 0, currentStep: '', logs: [] })}
                  className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
                >
                  Back to Options
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    )
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
              <li><span className="font-medium">Distribution:</span> {config.userDistribution}</li>
              <li><span className="font-medium">Custom Domain:</span> {config.customDomain?.enabled ? config.customDomain.domain : 'No'}</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">What's Included</h3>
            <ul className="space-y-1 text-sm">
              <li>• sst.config.ts (optimized configuration)</li>
              <li>• Updated package.json with SST dependencies</li>
              <li>• Step-by-step deployment instructions</li>
              <li>• AWS resource configuration</li>
              {config.customDomain?.enabled && <li>• Domain and SSL setup</li>}
              {config.userDistribution === 'worldwide' && <li>• Global CDN configuration</li>}
            </ul>
          </div>
        </div>
      </div>

      {/* Deployment Options */}
      <div className="grid md:grid-cols-3 gap-4">
        {/* Instant Deploy */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">Deploy Now</h3>
              <p className="text-sm opacity-90">Instant deployment with live progress</p>
            </div>
          </div>
          
          <button
            onClick={deployDirectly}
            className="w-full bg-white/20 hover:bg-white/30 text-white py-3 px-4 rounded-lg font-medium transition-colors mb-3"
            disabled={!repository}
          >
            🚀 Deploy to AWS Now
          </button>
          
          <div className="text-xs opacity-80 space-y-1">
            <p>• Live progress updates</p>
            <p>• 5-10 minutes to completion</p>
            <p>• Instant live URL</p>
          </div>
        </div>

        {/* Local Deploy Script */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center">
              <Terminal className="w-5 h-5 text-gray-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Deploy Script</h3>
              <p className="text-sm text-gray-600">Run locally on your machine</p>
            </div>
          </div>
          
          <button
            onClick={downloadDeployScript}
            className="w-full bg-gray-600 text-white py-3 px-4 rounded-lg hover:bg-gray-700 font-medium transition-colors mb-3"
            disabled={!repository}
          >
            Download Script
          </button>
          
          <div className="text-xs text-gray-500 space-y-1">
            <p>• node deploy-{config.projectName}.js</p>
            <p>• Run on your local machine</p>
            <p>• Full terminal output</p>
          </div>
        </div>

        {/* Manual Setup */}
        <div className="bg-white border border-gray-200 rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-blue-100 rounded-lg flex items-center justify-center">
              <Download className="w-5 h-5 text-blue-600" />
            </div>
            <div>
              <h3 className="font-semibold text-gray-900">Manual Setup</h3>
              <p className="text-sm text-gray-600">Download config files</p>
            </div>
          </div>
          
          <button
            onClick={downloadConfig}
            className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium transition-colors mb-3"
          >
            Download Config
          </button>
          
          <div className="text-xs text-gray-500 space-y-1">
            <p>• Extract to project root</p>
            <p>• npm install && sst deploy</p>
            <p>• Full control over process</p>
          </div>
        </div>
      </div>

      {/* Additional Actions */}
      <div className="flex flex-wrap gap-4 justify-center">
        {onSave && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium transition-colors"
          >
            <Save size={20} />
            <span>Save Configuration</span>
          </button>
        )}
        
        <button
          onClick={copyInstructions}
          className="flex items-center space-x-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium transition-colors"
        >
          <Copy size={20} />
          <span>Copy Instructions</span>
        </button>
      </div>

      {/* Save Modal */}
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
