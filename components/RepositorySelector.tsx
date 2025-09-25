import { useState, useEffect } from 'react'
import { Repository } from '../types'

interface RepositorySelectorProps {
  onSelect: (repo: Repository) => void
}

export default function RepositorySelector({ onSelect }: RepositorySelectorProps) {
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchRepositories()
  }, [])

  const fetchRepositories = async () => {
    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/repositories')
      const data = await response.json()
      
      // Check if we got an error response
      if (response.status !== 200 || data.error) {
        const errorMsg = data.error || 'Failed to fetch repositories'
        console.error('API Error:', errorMsg)
        setError(errorMsg)
        setRepositories([])
        return
      }
      
      // Ensure data is an array
      if (Array.isArray(data)) {
        setRepositories(data)
      } else {
        console.error('Expected array, got:', typeof data, data)
        setError('Invalid response format from GitHub API')
        setRepositories([])
      }
    } catch (error) {
      console.error('Failed to fetch repositories:', error)
      setError('Failed to connect to GitHub. Please check your connection.')
      setRepositories([])
    } finally {
      setLoading(false)
    }
  }

  const filteredRepos = Array.isArray(repositories) 
    ? repositories.filter(repo =>
        repo.name.toLowerCase().includes(search.toLowerCase()) ||
        repo.description?.toLowerCase().includes(search.toLowerCase())
      )
    : []

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading repositories...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="text-center p-8">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 max-w-md mx-auto">
          <div className="text-red-800 font-medium mb-2">Connection Error</div>
          <div className="text-red-600 text-sm mb-4">{error}</div>
          <button
            onClick={fetchRepositories}
            className="bg-red-600 text-white px-4 py-2 rounded-lg hover:bg-red-700 text-sm"
          >
            Try Again
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div>
        <input
          type="text"
          placeholder="Search repositories..."
          className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div className="grid gap-4 max-h-96 overflow-y-auto">
        {filteredRepos.map((repo) => (
          <div
            key={repo.id}
            className="p-4 border border-gray-200 rounded-lg hover:border-blue-500 cursor-pointer transition-colors"
            onClick={() => onSelect(repo)}
          >
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-gray-900">{repo.name}</h3>
                <p className="text-sm text-gray-600">{repo.description || 'No description'}</p>
                <div className="flex items-center mt-2 space-x-2">
                  {repo.language && (
                    <span className="px-2 py-1 bg-gray-100 text-gray-700 text-xs rounded">
                      {repo.language}
                    </span>
                  )}
                  {repo.private && (
                    <span className="px-2 py-1 bg-yellow-100 text-yellow-700 text-xs rounded">
                      Private
                    </span>
                  )}
                </div>
              </div>
              <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700">
                Analyze
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredRepos.length === 0 && repositories.length > 0 && (
        <div className="text-center py-8 text-gray-500">
          No repositories found matching your search.
        </div>
      )}

      {repositories.length === 0 && !loading && !error && (
        <div className="text-center py-8 text-gray-500">
          No repositories found. Make sure you have repositories in your GitHub account.
        </div>
      )}
    </div>
  )
}
