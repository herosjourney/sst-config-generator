import { useState } from 'react'
import { DeploymentConfig } from '../types'

interface ContextQuestionsProps {
  onComplete: (config: Partial<DeploymentConfig>) => void
  projectName: string
}

export default function ContextQuestions({ onComplete, projectName }: ContextQuestionsProps) {
  const [userDistribution, setUserDistribution] = useState<'single' | 'worldwide'>('single')
  const [customDomain, setCustomDomain] = useState(false)
  const [domain, setDomain] = useState('')
  const [region, setRegion] = useState('us-east-1')

  const handleSubmit = () => {
    const config: Partial<DeploymentConfig> = {
      userDistribution,
      customDomain: customDomain ? { enabled: true, domain } : { enabled: false },
      region: userDistribution === 'single' ? region : 'us-east-1', // Global CDN works from any region
      // Smart defaults for the rest
      expectedUsers: '<100', // Most sites start small
      performance: 'fast' // Good default
    }
    onComplete(config)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div className="text-center">
        <div className="w-16 h-16 bg-indigo-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
          <svg className="w-8 h-8 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </div>
        <h2 className="text-3xl font-bold text-gray-900 mb-2">Quick setup</h2>
        <p className="text-gray-600 text-lg">Just 2 questions to optimize your deployment</p>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 p-8 space-y-8">
        
        {/* User Distribution */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Where are your users located?</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <label className="relative cursor-pointer">
              <input 
                type="radio" 
                name="distribution" 
                value="single" 
                checked={userDistribution === 'single'}
                onChange={(e) => setUserDistribution(e.target.value as 'single')}
                className="peer sr-only" 
              />
              <div className="p-6 border-2 border-gray-200 rounded-xl peer-checked:border-indigo-500 peer-checked:bg-indigo-50 transition-all hover:border-gray-300">
                <div className="text-center">
                  <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  </div>
                  <div className="font-semibold text-gray-900 mb-1">One region</div>
                  <div className="text-sm text-gray-500 mb-3">Lower cost, simple setup</div>
                  <div className="text-xs text-gray-400">Best for local businesses</div>
                </div>
              </div>
            </label>
            
            <label className="relative cursor-pointer">
              <input 
                type="radio" 
                name="distribution" 
                value="worldwide" 
                checked={userDistribution === 'worldwide'}
                onChange={(e) => setUserDistribution(e.target.value as 'worldwide')}
                className="peer sr-only" 
              />
              <div className="p-6 border-2 border-gray-200 rounded-xl peer-checked:border-indigo-500 peer-checked:bg-indigo-50 transition-all hover:border-gray-300">
                <div className="text-center">
                  <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                    <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div className="font-semibold text-gray-900 mb-1">Worldwide</div>
                  <div className="text-sm text-gray-500 mb-3">Global CDN, faster everywhere</div>
                  <div className="text-xs text-gray-400">Best for global audience</div>
                </div>
              </div>
            </label>
          </div>
        </div>

        {/* Region Selection for Single */}
        {userDistribution === 'single' && (
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Choose your region</h3>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
            >
              <option value="us-east-1">🇺🇸 US East (Virginia) - Most popular</option>
              <option value="us-west-2">🇺🇸 US West (Oregon)</option>
              <option value="eu-west-1">🇪🇺 Europe (Ireland)</option>
              <option value="ap-southeast-1">🌏 Asia Pacific (Singapore)</option>
              <option value="ap-northeast-1">🇯🇵 Asia Pacific (Tokyo)</option>
            </select>
          </div>
        )}

        {/* Custom Domain */}
        <div>
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Custom domain</h3>
          <div className="space-y-4">
            <label className="flex items-start space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={customDomain}
                onChange={(e) => setCustomDomain(e.target.checked)}
                className="mt-1 w-5 h-5 text-indigo-600 rounded focus:ring-indigo-500"
              />
              <div>
                <div className="font-medium text-gray-900">Use my own domain</div>
                <div className="text-sm text-gray-500">Like mysite.com (includes free SSL certificate)</div>
              </div>
            </label>
            
            {customDomain && (
              <div className="mt-4">
                <input
                  type="text"
                  placeholder="mysite.com"
                  value={domain}
                  onChange={(e) => setDomain(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-lg"
                />
                <p className="mt-2 text-sm text-gray-500">
                  💡 You'll need to update your DNS settings after deployment
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Cost Estimate Preview */}
        <div className="bg-gray-50 rounded-xl p-6">
          <div className="flex items-center justify-between">
            <div>
              <div className="font-semibold text-gray-900">Estimated monthly cost</div>
              <div className="text-sm text-gray-600">
                {userDistribution === 'worldwide' ? 'Global CDN + hosting' : 'Regional hosting'}
                {customDomain && ' + custom domain'}
              </div>
            </div>
            <div className="text-right">
              <div className="text-2xl font-bold text-indigo-600">
                ${userDistribution === 'worldwide' ? '5-15' : '1-5'}
              </div>
              <div className="text-sm text-gray-500">per month</div>
            </div>
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full bg-indigo-600 text-white py-4 px-6 rounded-xl hover:bg-indigo-700 font-semibold text-lg transition-colors"
        >
          Generate Configuration
        </button>
      </div>
    </div>
  )
}
