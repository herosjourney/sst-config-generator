import { useState } from 'react'
import { useSession, signIn, signOut } from 'next-auth/react'
import { Repository, ProjectAnalysis, DeploymentConfig } from '../types'
import RepositorySelector from '../components/RepositorySelector'
import ContextQuestions from '../components/ContextQuestions'
import ConfigResult from '../components/ConfigResult'
import SavedConfigs from '../components/SavedConfigs'
import { Github, Settings, History } from 'lucide-react'

type Step = 'auth' | 'repos' | 'analysis' | 'questions' | 'result' | 'saved'

export default function Home() {
  const { data: session, status } = useSession()
  const [currentStep, setCurrentStep] = useState<Step>('auth')
  const [selectedRepo, setSelectedRepo] = useState<Repository | null>(null)
  const [analysis, setAnalysis] = useState<ProjectAnalysis | null>(null)
  const [loading, setLoading] = useState(false)
  const [finalConfig, setFinalConfig] = useState<DeploymentConfig | null>(null)

  const analyzeRepository = async (repo: Repository) => {
    setSelectedRepo(repo)
    setLoading(true)
    
    try {
      const [owner, repoName] = repo.full_name.split('/')
      const response = await fetch(`/api/analyze/${owner}/${repoName}`)
      const analysisData = await response.json()
      
      setAnalysis(analysisData)
      
      // Always show questions to configure distribution and custom domain
      setCurrentStep('questions')
    } catch (error) {
      console.error('Analysis failed:', error)
      alert('Failed to analyze repository. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleQuestionsComplete = (contextConfig: Partial<DeploymentConfig>) => {
    if (!selectedRepo || !analysis) return

    const config: DeploymentConfig = {
      projectName: selectedRepo.name,
      framework: analysis.framework,
      projectType: analysis.type,
      buildCommand: analysis.buildCommand,
      outputDir: analysis.outputDir,
      // Smart defaults
      performance: 'fast',
      expectedUsers: '<100',
      // User choices
      ...contextConfig
    } as DeploymentConfig

    setFinalConfig(config)
    setCurrentStep('result')
  }

  const saveConfiguration = async (name: string) => {
    if (!finalConfig) return

    try {
      const response = await fetch('/api/configs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          repository: selectedRepo?.full_name,
          config: finalConfig
        })
      })

      if (response.ok) {
        alert('Configuration saved successfully!')
      }
    } catch (error) {
      console.error('Save failed:', error)
      alert('Failed to save configuration')
    }
  }

  const resetFlow = () => {
    setCurrentStep('repos')
    setSelectedRepo(null)
    setAnalysis(null)
    setFinalConfig(null)
  }

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!session) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="max-w-4xl mx-auto px-4 py-16">
          <div className="text-center">
            <div className="mb-8">
              <div className="inline-flex items-center justify-center w-20 h-20 bg-white/20 rounded-2xl mb-8 backdrop-blur-sm">
                <svg className="w-10 h-10 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
              </div>
              <h1 className="text-5xl font-bold text-gray-900 mb-6 leading-tight">
                Deploy to AWS<br/>
                <span className="text-indigo-600">in minutes</span>
              </h1>
              <p className="text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed">
                Connect your GitHub repo, answer 2 quick questions, and get a production-ready AWS deployment configuration with smart defaults.
              </p>
            </div>

            <div className="bg-white rounded-2xl shadow-xl p-8 max-w-md mx-auto backdrop-blur-sm">
              <div className="mb-6">
                <Github size={48} className="mx-auto text-gray-700 mb-4" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Get Started</h2>
                <p className="text-gray-600">
                  Connect GitHub to analyze your repositories and generate optimized configurations
                </p>
              </div>

              <button
                onClick={() => signIn('github')}
                className="w-full bg-gray-900 text-white py-3 px-4 rounded-xl hover:bg-gray-800 flex items-center justify-center space-x-2 font-medium transition-colors"
              >
                <Github size={20} />
                <span>Connect GitHub Account</span>
              </button>

              <div className="mt-6 text-sm text-gray-500">
                <p>✓ Secure OAuth • ✓ Read-only access • ✓ No code stored</p>
              </div>
            </div>

            <div className="mt-12 grid md:grid-cols-3 gap-8 max-w-3xl mx-auto">
              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-indigo-600 font-bold text-lg">1</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Connect Repository</h3>
                <p className="text-gray-600">Link your GitHub and select a project to deploy</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-indigo-600 font-bold text-lg">2</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Smart Analysis</h3>
                <p className="text-gray-600">AI detects your framework and optimizes automatically</p>
              </div>
              
              <div className="text-center">
                <div className="w-12 h-12 bg-indigo-100 rounded-xl flex items-center justify-center mx-auto mb-4">
                  <span className="text-indigo-600 font-bold text-lg">3</span>
                </div>
                <h3 className="font-semibold text-gray-900 mb-2">Deploy Ready</h3>
                <p className="text-gray-600">Download your AWS configuration and deploy</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white/80 backdrop-blur-md border-b border-gray-200/50 sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center">
                  <svg className="w-5 h-5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                  </svg>
                </div>
                <h1 className="text-xl font-bold text-gray-900">AWS Deploy</h1>
              </div>
              
              <nav className="hidden md:flex space-x-1">
                <button
                  onClick={() => setCurrentStep('repos')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    ['repos', 'analysis', 'questions', 'result'].includes(currentStep)
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <Settings size={16} className="inline mr-1" />
                  Generate
                </button>
                
                <button
                  onClick={() => setCurrentStep('saved')}
                  className={`px-4 py-2 rounded-lg text-sm font-medium ${
                    currentStep === 'saved' 
                      ? 'bg-indigo-50 text-indigo-700' 
                      : 'text-gray-600 hover:text-gray-900 hover:bg-gray-50'
                  }`}
                >
                  <History size={16} className="inline mr-1" />
                  Saved
                </button>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-gray-200 rounded-full flex items-center justify-center">
                  <span className="text-xs font-medium text-gray-600">
                    {session.user?.name?.charAt(0) || session.user?.email?.charAt(0)}
                  </span>
                </div>
                <span className="hidden md:block text-sm text-gray-700">
                  {session.user?.name || session.user?.email?.split('@')[0]}
                </span>
              </div>
              <button 
                onClick={() => signOut()}
                className="text-sm text-gray-500 hover:text-gray-700 p-2"
                title="Sign out"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {loading && (
          <div className="fixed inset-0 bg-black/20 backdrop-blur-sm flex items-center justify-center z-50">
            <div className="bg-white rounded-2xl p-8 flex flex-col items-center space-y-4 mx-4 max-w-sm">
              <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin"></div>
              <div className="text-center">
                <h3 className="font-semibold text-gray-900 mb-1">Analyzing repository</h3>
                <p className="text-gray-600 text-sm">AI is detecting your framework and dependencies...</p>
              </div>
            </div>
          </div>
        )}

        {currentStep === 'repos' && (
          <div className="fade-in">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-gray-900 mb-4">Choose your repository</h2>
              <p className="text-gray-600 text-lg">Select a project to analyze and generate deployment configuration</p>
            </div>
            <RepositorySelector onSelect={analyzeRepository} />
          </div>
        )}

        {currentStep === 'questions' && selectedRepo && (
          <div className="fade-in">
            <ContextQuestions
              projectName={selectedRepo.name}
              onComplete={handleQuestionsComplete}
            />
          </div>
        )}

        {currentStep === 'result' && finalConfig && (
          <div className="fade-in">
            <ConfigResult 
              config={finalConfig} 
              repository={selectedRepo}
              onSave={saveConfiguration}
            />
            
            <div className="text-center mt-12">
              <button
                onClick={resetFlow}
                className="bg-gray-600 text-white px-6 py-3 rounded-xl hover:bg-gray-700 font-medium transition-colors"
              >
                ← Analyze Another Repository
              </button>
            </div>
          </div>
        )}

        {currentStep === 'saved' && (
          <div className="fade-in">
            <SavedConfigs />
          </div>
        )}
      </main>
    </div>
  )
}
