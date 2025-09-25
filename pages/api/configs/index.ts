import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'

const savedConfigs: Record<string, any[]> = {}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, {})
  
  if (!session?.user?.email) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const userEmail = session.user.email

  if (req.method === 'GET') {
    const configs = savedConfigs[userEmail] || []
    res.json(configs)
  } else if (req.method === 'POST') {
    const config = {
      id: Date.now().toString(),
      ...req.body,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }

    if (!savedConfigs[userEmail]) {
      savedConfigs[userEmail] = []
    }
    
    savedConfigs[userEmail].push(config)
    res.json(config)
  } else {
    res.status(405).json({ error: 'Method not allowed' })
  }
}
