import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { authOptions } from './auth/[...nextauth]'
import AWSDeployBot from '../../lib/aws-deploy-bot'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  const session = await getServerSession(req, res, authOptions)
  
  if (!session) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const { repository, config } = req.body

    // Set up Server-Sent Events for real-time progress
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Cache-Control'
    })

    // Progress callback function
    const progressCallback = (progress: number, step: string, message: string, deploymentUrl?: string) => {
      const data = JSON.stringify({
        progress,
        step,
        message,
        deploymentUrl,
        timestamp: new Date().toISOString()
      })
      
      res.write(`data: ${data}\n\n`)
    }

    // Create deployment bot with progress callback
    const bot = new AWSDeployBot()
    
    try {
      const result = await bot.deploy({
        repoUrl: repository.clone_url || repository.html_url,
        stage: 'production',
        progressCallback
      })

      // Send final success message
      progressCallback(100, 'Deployment complete!', '✅ Your app is now live!', result.deploymentUrl)
      
      // Close the stream
      res.write('data: {"type": "complete"}\n\n')
      res.end()

    } catch (deployError) {
      // Send error message
      progressCallback(0, 'Deployment failed', `❌ Error: ${deployError instanceof Error ? deployError.message : 'Unknown error'}`)
      res.write('data: {"type": "error"}\n\n')
      res.end()
    }

  } catch (error) {
    console.error('Deploy API error:', error)
    res.status(500).json({ error: 'Failed to start deployment' })
  }
}
