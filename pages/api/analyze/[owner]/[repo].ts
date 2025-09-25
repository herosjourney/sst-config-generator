import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from '../../auth/[...nextauth]'
import { GitHubAnalyzer } from '../../../../lib/github'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, authOptions)
  
  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { owner, repo } = req.query

  try {
    const analyzer = new GitHubAnalyzer(session.accessToken as string)
    const analysis = await analyzer.analyzeProject(owner as string, repo as string)
    res.json(analysis)
  } catch (error) {
    console.error('Analysis error:', error)
    res.status(500).json({ error: 'Failed to analyze repository' })
  }
}
