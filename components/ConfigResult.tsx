import { useState } from 'react'
import { DeploymentConfig, Repository } from '../types'
import { Download, Save, Copy, Terminal } from 'lucide-react'

interface ConfigResultProps {
  config: DeploymentConfig
  repository?: Repository
  onSave?: (name: string) => void
}

export default function ConfigResult({ config, repository, onSave }: ConfigResultProps) {
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

  const downloadDeployScript = async () => {
    if (!repository) {
      alert('Repository information not available for deployment script')
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
        a.download = `${config.projectName}-deploy-package.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Deploy script download failed:', error)
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

## Recommended: Quick Local Deploy
1. Click "Download Deploy Package"
2. Extract the ZIP file
3. Open terminal in the extracted folder
4. Run: node quick-deploy.js
5. Follow the prompts (will check AWS credentials automatically)

## Manual Setup Alternative:
1. Click "Download Config" to get SST configuration files
2. Extract files to your project root directory
3. Install dependencies: npm install
4. Install SST: npm install sst@latest
5. Deploy to AWS: npx sst deploy --stage production

## Prerequisites:
- AWS CLI configured (run: aws configure)
- Node.js installed
- Git installed
- Proper AWS permissions for creating resources

## Your Configuration Summary:
- Project: ${config.projectName}
- Framework: ${config.framework}  
- Type: ${config.projectType}
- Region: ${config.region}
- Distribution: ${config.userDistribution}
- Custom Domain: ${config.customDomain?.enabled ? config.customDomain.domain : 'Disabled'}
${config.buildCommand ? `- Build Command: ${config.buildCommand}` : ''}
${config.outputDir ? `- Output Directory: ${config.outputDir}` : ''}

## What Gets Deployed:
${config.projectType === 'SSR' ? '- Lambda functions for server-side rendering' : '- S3 bucket for static hosting'}
${config.customDomain?.enabled ? '- Custom domain with SSL certificate' : '- AWS-generated URLs'}  
${config.userDistribution === 'worldwide' ? '- CloudFront CDN for global distribution' : '- Regional deployment'}
- Infrastructure as Code via SST

## Estimated Costs:
- Static sites: $1-5/month (mostly free tier)
- SSR sites: $5-25/month (depending on traffic)
- Custom domains: $0.50/month per domain

## Security Note:
Your AWS credentials stay on your local machine and never leave your computer. 
This follows AWS security best practices.

## Useful Commands After Deployment:
- View logs: npx sst logs
- Remove all resources: npx sst remove  
- Development mode: npx sst dev
- Open web console: npx sst console

## Support:
- SST Documentation: https://sst.dev/docs/
- AWS Documentation: https://docs.aws.amazon.com/
`

    navigator.clipboard.writeText(instructions)
    
    // Optional: Show a brief confirmation
    const button = document.activeElement
    if (button && button.textContent) {
      const originalText = button.textContent
      button.textContent = 'Copied!'
      setTimeout(() => {
        button.textContent = originalText
      }, 2000)
    }
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
      <div className="grid md:grid-cols-2 gap-6">
        {/* Quick Local Deploy */}
        <div className="bg-gradient-to-br from-indigo-500 to-purple-600 text-white rounded-xl p-6">
          <div className="flex items-center space-x-3 mb-4">
            <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-semibold">Quick Local Deploy</h3>
              <p className="text-sm opacity-90">Automated local deployment script</p>
            </div>
          </div>
          
          <button
            onClick={downloadDeployScript}
            className="w-full bg-white/20 hover:bg-white/30 text-white py-3 px-4 rounded-lg font-medium transition-colors mb-3"
            disabled={!repository}
          >
            📥 Download Deploy Package
          </button>
          
          <div className="text-xs opacity-80 space-y-1">
            <p>• Uses your AWS credentials</p>
            <p>• Runs on your local machine</p>
            <p>• One command deployment</p>
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

      {/* Security Note */}
      <div className="p-6 bg-amber-50 border border-amber-200 rounded-lg">
        <div className="flex items-start space-x-3">
          <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0 mt-1">
            <span className="text-amber-600 text-sm">🔒</span>
          </div>
          <div>
            <h4 className="font-semibold text-amber-800 mb-2">Secure Local Deployment</h4>
            <p className="text-amber-700 text-sm">
              Your AWS credentials stay on your machine. The deployment package runs locally using your configured AWS CLI, 
              ensuring your credentials never leave your computer. This is the recommended approach for security and reliability.
            </p>
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
