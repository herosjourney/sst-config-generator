import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import { GitHubAnalyzer } from '../../lib/github'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const analyzer = new GitHubAnalyzer(session.accessToken as string)
    const repositories = await analyzer.getRepositories()
    res.json(repositories)
  } catch (error) {
    console.error('GitHub API error:', error)
    res.status(500).json({ error: 'Failed to fetch repositories' })
  }
}
