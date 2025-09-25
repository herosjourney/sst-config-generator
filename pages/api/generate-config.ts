import { NextApiRequest, NextApiResponse } from 'next'
import { SSTGenerator } from '../../lib/sst-generator'
import archiver from 'archiver'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const config = req.body
    const generator = new SSTGenerator()
    const files = generator.generateConfig(config)

    const archive = archiver('zip', { zlib: { level: 9 } })
    
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${config.projectName}-sst-config.zip"`)
    
    archive.pipe(res)
    
    Object.entries(files).forEach(([filename, content]) => {
      archive.append(content, { name: filename })
    })

    const instructions = `# SST Deployment Instructions

## Prerequisites
1. Install SST: \`npm install -g sst\`
2. Configure AWS CLI with your credentials
3. Ensure you have the necessary AWS permissions

## Setup Steps
1. Extract these files to your project root
2. Install dependencies: \`npm install\`
3. Deploy to AWS: \`sst deploy --stage production\`

## What gets deployed:
- ${config.projectType === 'SSR' ? 'Lambda functions for server-side rendering' : 'S3 bucket for static hosting'}
${config.customDomain?.enabled ? '- Custom domain configuration' : '- Default AWS URLs'}
${config.userDistribution === 'worldwide' ? '- CloudFront CDN for global distribution' : '- Regional deployment'}

## Estimated monthly cost: $5-25 (depending on traffic)

For more information, visit: https://sst.dev/docs/
`;

    archive.append(instructions, { name: 'DEPLOYMENT_INSTRUCTIONS.md' })
    
    await archive.finalize()
  } catch (error) {
    res.status(500).json({ error: 'Failed to generate configuration' })
  }
}
