import { NextApiRequest, NextApiResponse } from 'next'
import { SSTGenerator } from '../../lib/sst-generator'
import archiver from 'archiver'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  // DEBUGGING CODE
  console.log('=== API ENDPOINT CALLED ===')
  console.log('Method:', req.method)
  console.log('URL:', req.url)
  console.log('Headers:', req.headers)
  
  if (req.method !== 'POST') {
    console.log('Returning 405 - method is:', req.method)
    return res.status(405).json({ error: 'Method not allowed' })
  }

  try {
    const { repository, config } = req.body
    
    if (!repository) {
      return res.status(400).json({ error: 'Repository information required' })
    }

    // Generate SST config files
    const generator = new SSTGenerator()
    const configFiles = generator.generateConfig(config)

    // Generate the local deployment script
    const quickDeployScript = generateQuickDeployScript(repository, config)
    const packageJson = generatePackageJson(config)
    const readme = generateReadme(config, repository)

    // Create ZIP archive
    const archive = archiver('zip', { zlib: { level: 9 } })
    
    res.setHeader('Content-Type', 'application/zip')
    res.setHeader('Content-Disposition', `attachment; filename="${config.projectName}-deploy-package.zip"`)
    
    archive.pipe(res)
    
    // Add all files to the archive
    Object.entries(configFiles).forEach(([filename, content]) => {
      archive.append(content, { name: filename })
    })
    
    archive.append(quickDeployScript, { name: 'quick-deploy.js' })
    archive.append(packageJson, { name: 'package.json' })
    archive.append(readme, { name: 'README.md' })
    
    await archive.finalize()
  } catch (error) {
    console.error('Deploy script generation failed:', error)
    res.status(500).json({ error: 'Failed to generate deployment package' })
  }
}

function generateQuickDeployScript(repository: any, config: any): string {
  return `#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

// ANSI color codes for better console output
const colors = {
  reset: '\\x1b[0m',
  bright: '\\x1b[1m',
  red: '\\x1b[31m',
  green: '\\x1b[32m',
  yellow: '\\x1b[33m',
  blue: '\\x1b[34m',
  cyan: '\\x1b[36m'
};

class LocalSST_Deployer {
  constructor() {
    this.projectName = '${config.projectName}';
    this.repoUrl = '${repository.clone_url || repository.html_url}';
    this.region = '${config.region || 'us-east-1'}';
  }

  log(message, color = 'reset') {
    console.log(\`\${colors[color]}\${message}\${colors.reset}\`);
  }

  error(message) {
    this.log(\`❌ \${message}\`, 'red');
  }

  success(message) {
    this.log(\`✅ \${message}\`, 'green');
  }

  info(message) {
    this.log(\`ℹ️  \${message}\`, 'cyan');
  }

  async checkPrerequisites() {
    this.log('\\n🔍 Checking prerequisites...', 'bright');
    
    const checks = [
      { cmd: 'git --version', name: 'Git', error: 'Git not installed. Please install Git first.' },
      { cmd: 'node --version', name: 'Node.js', error: 'Node.js not installed. Please install Node.js first.' },
      { cmd: 'npm --version', name: 'npm', error: 'npm not installed. Please install npm first.' },
      { cmd: 'aws sts get-caller-identity', name: 'AWS credentials', error: 'AWS CLI not configured. Run: aws configure' }
    ];

    for (const check of checks) {
      try {
        execSync(check.cmd, { stdio: 'pipe' });
        this.success(\`\${check.name} is available\`);
      } catch (error) {
        this.error(check.error);
        process.exit(1);
      }
    }

    // Show AWS account info
    try {
      const awsInfo = execSync('aws sts get-caller-identity', { encoding: 'utf8' });
      const account = JSON.parse(awsInfo);
      this.info(\`AWS Account: \${account.Account}\`);
      this.info(\`AWS Region: \${this.region}\`);
    } catch (error) {
      this.info('Could not retrieve AWS account information');
    }
  }

  async confirmDeployment() {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      this.log('\\n📋 Deployment Summary:', 'bright');
      this.log(\`   Project: \${this.projectName}\`);
      this.log(\`   Repository: \${this.repoUrl}\`);
      this.log(\`   Region: \${this.region}\`);
      this.log(\`   This will create AWS resources in your account.\`);
      
      rl.question('\\n❓ Continue with deployment? (y/N): ', (answer) => {
        rl.close();
        resolve(answer.toLowerCase() === 'y' || answer.toLowerCase() === 'yes');
      });
    });
  }

  async cloneAndDeploy() {
    this.log('\\n📥 Cloning repository...', 'bright');
    
    const tempDir = \`temp-\${Date.now()}\`;
    
    try {
      // Clone repository
      execSync(\`git clone "\${this.repoUrl}" "\${tempDir}"\`, { stdio: 'inherit' });
      process.chdir(tempDir);
      
      this.success('Repository cloned successfully');
      
      // Copy SST config files
      this.log('\\n⚙️ Setting up SST configuration...', 'bright');
      
      // Copy the generated files from parent directory
      const filesToCopy = ['sst.config.ts'];
      filesToCopy.forEach(file => {
        if (fs.existsSync(path.join('..', file))) {
          fs.copyFileSync(path.join('..', file), file);
        }
      });
      
      // Install dependencies
      this.log('\\n📦 Installing dependencies...', 'bright');
      execSync('npm install', { stdio: 'inherit' });
      
      // Add SST if not already present
      try {
        execSync('npm list sst', { stdio: 'pipe' });
      } catch (error) {
        this.info('Installing SST...');
        execSync('npm install sst@latest', { stdio: 'inherit' });
      }
      
      this.success('Dependencies installed');
      
      // Deploy to AWS
      this.log('\\n🚀 Deploying to AWS...', 'bright');
      this.info('This may take 5-10 minutes for the first deployment...');
      
      execSync('npx sst deploy --stage production', { stdio: 'inherit' });
      
      this.success('🎉 Deployment completed successfully!');
      
      // Show outputs
      try {
        this.log('\\n📊 Deployment Information:', 'bright');
        execSync('npx sst env', { stdio: 'inherit' });
      } catch (error) {
        this.info('Could not retrieve deployment outputs');
      }
      
      // Cleanup
      process.chdir('..');
      execSync(\`rm -rf "\${tempDir}"\`, { stdio: 'pipe' });
      
    } catch (error) {
      this.error(\`Deployment failed: \${error.message}\`);
      
      // Cleanup on error
      try {
        process.chdir('..');
        execSync(\`rm -rf "\${tempDir}"\`, { stdio: 'pipe' });
      } catch (cleanupError) {
        // Ignore cleanup errors
      }
      
      process.exit(1);
    }
  }

  async run() {
    try {
      this.log('=====================================', 'cyan');
      this.log('🚀 SST Local Deployment', 'cyan');
      this.log(\`   Project: \${this.projectName}\`, 'cyan');
      this.log('=====================================', 'cyan');

      await this.checkPrerequisites();
      
      const shouldDeploy = await this.confirmDeployment();
      if (!shouldDeploy) {
        this.info('Deployment cancelled by user');
        process.exit(0);
      }

      await this.cloneAndDeploy();
      
      this.log('\\n🔧 Useful Commands:', 'bright');
      this.log('   • View logs: npx sst logs');
      this.log('   • Remove deployment: npx sst remove');
      this.log('   • Dev mode: npx sst dev');

    } catch (error) {
      this.error(\`Deployment failed: \${error.message}\`);
      process.exit(1);
    }
  }
}

// Run the deployment
const deployer = new LocalSST_Deployer();
deployer.run();`;
}

function generatePackageJson(config: any): string {
  return JSON.stringify({
    "name": config.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    "version": "1.0.0",
    "type": "module",
    "scripts": {
      "deploy": "node quick-deploy.js",
      "dev": "sst dev",
      "build": "sst build",
      "remove": "sst remove"
    },
    "devDependencies": {
      "sst": "latest"
    }
  }, null, 2);
}

function generateReadme(config: any, repository: any): string {
  return `# ${config.projectName} - AWS Deployment

## Quick Start

1. **Prerequisites Check**
   - ✅ AWS CLI configured (\`aws configure\`)
   - ✅ Node.js installed
   - ✅ Git installed

2. **Deploy**
   \`\`\`bash
   node quick-deploy.js
   \`\`\`

## What This Does

- Clones your repository: ${repository.html_url}
- Sets up SST configuration for ${config.framework}
- Deploys to AWS region: ${config.region}
- ${config.userDistribution === 'worldwide' ? 'Sets up global CDN' : 'Regional deployment'}
- ${config.customDomain?.enabled ? 'Configures custom domain: ' + config.customDomain.domain : 'Uses AWS-generated URLs'}

## Manual Deployment

If you prefer manual control:

\`\`\`bash
# 1. Clone your repository
git clone ${repository.clone_url || repository.html_url} my-project
cd my-project

# 2. Copy SST config files (sst.config.ts) to your project root

# 3. Install dependencies
npm install
npm install sst@latest

# 4. Deploy
npx sst deploy --stage production
\`\`\`

## Useful Commands

- \`npx sst dev\` - Start development mode
- \`npx sst logs\` - View deployment logs  
- \`npx sst remove\` - Remove all AWS resources
- \`npx sst console\` - Open web console

## Security Note

This deployment runs entirely on your local machine using your AWS credentials. Your credentials never leave your computer.
`;
}
