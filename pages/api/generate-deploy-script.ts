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
    
    archive.append(quickDeployScript, { name: 'deploy.sh' })
    archive.append(packageJson, { name: 'package.json' })
    archive.append(readme, { name: 'README.md' })
    
    await archive.finalize()
  } catch (error) {
    console.error('Deploy script generation failed:', error)
    res.status(500).json({ error: 'Failed to generate deployment package' })
  }
}

function generateQuickDeployScript(repository: any, config: any): string {
  const packageName = config.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  
  return `#!/bin/bash

# SST Auto-Deploy Script
# Generated for: ${config.projectName}
# Repository: ${repository.html_url}

set -e  # Exit on any error

# Colors for output
RED='\\033[0;31m'
GREEN='\\033[0;32m'
YELLOW='\\033[1;33m'
BLUE='\\033[0;34m'
CYAN='\\033[0;36m'
NC='\\033[0m' # No Color

# Project configuration
PROJECT_NAME="${config.projectName}"
REPO_URL="${repository.html_url}"
AWS_REGION="${config.region || 'us-east-1'}"

echo -e "\${CYAN}=========================================\${NC}"
echo -e "\${CYAN}🚀 SST Auto-Deploy for \${PROJECT_NAME}\${NC}"
echo -e "\${CYAN}=========================================\${NC}"

# Function to print colored output
log_info() { echo -e "\${BLUE}ℹ️  \$1\${NC}"; }
log_success() { echo -e "\${GREEN}✅ \$1\${NC}"; }
log_error() { echo -e "\${RED}❌ \$1\${NC}"; }
log_warning() { echo -e "\${YELLOW}⚠️  \$1\${NC}"; }

# Function to check if command exists
command_exists() {
    command -v "\$1" >/dev/null 2>&1
}

# Function to check prerequisites
check_prerequisites() {
    log_info "Checking prerequisites..."
    
    local all_good=true
    
    # Check Git
    if command_exists git; then
        log_success "Git is installed"
    else
        log_error "Git is not installed. Please install Git first."
        echo "  📥 Download: https://git-scm.com/downloads"
        all_good=false
    fi
    
    # Check Node.js
    if command_exists node; then
        local node_version=\$(node --version)
        log_success "Node.js is installed (\$node_version)"
    else
        log_error "Node.js is not installed. Please install Node.js first."
        echo "  📥 Download: https://nodejs.org/"
        all_good=false
    fi
    
    # Check npm
    if command_exists npm; then
        local npm_version=\$(npm --version)
        log_success "npm is installed (\$npm_version)"
    else
        log_error "npm is not installed. Please install npm first."
        all_good=false
    fi
    
    # Check AWS CLI
    if command_exists aws; then
        log_success "AWS CLI is installed"
        
        # Check AWS credentials
        if aws sts get-caller-identity >/dev/null 2>&1; then
            local account_id=\$(aws sts get-caller-identity --query Account --output text 2>/dev/null)
            local current_region=\$(aws configure get region 2>/dev/null || echo "us-east-1")
            log_success "AWS credentials are configured"
            log_info "AWS Account: \$account_id"
            log_info "AWS Region: \$current_region"
        else
            log_error "AWS CLI is not configured with valid credentials"
            echo "  🔧 Run: aws configure"
            echo "  📖 Guide: https://docs.aws.amazon.com/cli/latest/userguide/cli-configure-quickstart.html"
            all_good=false
        fi
    else
        log_error "AWS CLI is not installed"
        echo "  📥 Install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
        all_good=false
    fi
    
    if [ "\$all_good" = false ]; then
        echo ""
        log_error "Please install the missing prerequisites and run this script again."
        exit 1
    fi
    
    echo ""
    log_success "All prerequisites satisfied!"
}

# Function to setup SST configuration
setup_sst_config() {
    log_info "Setting up SST configuration..."
    
    # Create backup of existing files if they exist
    if [ -f "sst.config.ts" ]; then
        log_warning "Existing sst.config.ts found. Creating backup..."
        cp sst.config.ts sst.config.ts.backup.\$(date +%s)
    fi
    
    if [ -f "package.json" ]; then
        log_info "Updating existing package.json with SST dependencies..."
        # Use Node.js to update package.json with SST
        node -e "
            const fs = require('fs');
            const pkg = JSON.parse(fs.readFileSync('package.json', 'utf8'));
            pkg.scripts = { ...pkg.scripts, 'sst:dev': 'sst dev', 'sst:build': 'sst build', 'sst:deploy': 'sst deploy', 'sst:remove': 'sst remove' };
            pkg.devDependencies = { ...pkg.devDependencies, 'sst': '^3.0.0' };
            fs.writeFileSync('package.json', JSON.stringify(pkg, null, 2));
        "
    else
        log_info "Creating package.json..."
        cat > package.json << 'EOL'
{
  "name": "${packageName}",
  "version": "1.0.0",
  "scripts": {
    "sst:dev": "sst dev",
    "sst:build": "sst build", 
    "sst:deploy": "sst deploy",
    "sst:remove": "sst remove"
  },
  "devDependencies": {
    "sst": "^3.0.0"
  }
}
EOL
    fi
    
    # The sst.config.ts will be created by the downloaded package
    log_success "SST configuration ready"
}

# Function to install dependencies
install_dependencies() {
    log_info "Installing dependencies..."
    
    # Install project dependencies
    npm install
    
    # Check if SST is globally available, if not install it
    if ! command_exists sst; then
        log_info "Installing SST globally..."
        npm install -g sst@latest
    fi
    
    log_success "Dependencies installed"
}

# Function to deploy to AWS
deploy_to_aws() {
    log_info "Starting deployment to AWS..."
    log_warning "This may take 5-10 minutes for the first deployment..."
    
    # Set AWS region if specified
    if [ -n "\$AWS_REGION" ]; then
        export AWS_REGION="\$AWS_REGION"
        log_info "Using AWS region: \$AWS_REGION"
    fi
    
    # Bootstrap SST if needed (this is idempotent)
    log_info "Bootstrapping SST..."
    sst bootstrap --stage production || log_warning "Bootstrap may have already been completed"
    
    # Deploy the application
    log_info "Deploying application..."
    sst deploy --stage production
    
    log_success "🎉 Deployment completed successfully!"
}

# Function to show deployment info
show_deployment_info() {
    echo ""
    log_info "Retrieving deployment information..."
    
    # Try to get deployment outputs
    if sst env --stage production >/dev/null 2>&1; then
        echo -e "\${BLUE}📊 Deployment Information:\${NC}"
        sst env --stage production
    else
        log_warning "Could not retrieve deployment outputs"
    fi
    
    echo ""
    echo -e "\${BLUE}🔧 Useful Commands:\${NC}"
    echo "  • View logs: sst logs --stage production"
    echo "  • Open console: sst console --stage production" 
    echo "  • Remove deployment: sst remove --stage production"
    echo "  • Development mode: sst dev"
    echo ""
    echo -e "\${GREEN}🌐 Your application is now deployed to AWS!\${NC}"
}

# Function to confirm deployment
confirm_deployment() {
    echo ""
    echo -e "\${BLUE}📋 Deployment Summary:\${NC}"
    echo "  Project: \$PROJECT_NAME"
    echo "  Repository: \$REPO_URL"
    echo "  AWS Region: \${AWS_REGION:-default}"
    echo "  Stage: production"
    echo ""
    echo -e "\${YELLOW}This will create AWS resources in your account.\${NC}"
    echo ""
    
    read -p "Continue with deployment? (y/N): " -n 1 -r
    echo ""
    
    if [[ ! \$REPLY =~ ^[Yy]\$ ]]; then
        log_info "Deployment cancelled by user"
        exit 0
    fi
}

# Main execution
main() {
    check_prerequisites
    confirm_deployment
    setup_sst_config
    install_dependencies
    deploy_to_aws
    show_deployment_info
}

# Run main function
main "\$@"`;
}

function generatePackageJson(config: any): string {
  return JSON.stringify({
    "name": config.projectName.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
    "version": "1.0.0",
    "type": "module",
    "scripts": {
      "deploy": "bash deploy.sh",
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
   chmod +x deploy.sh
   ./deploy.sh
   \`\`\`

## What This Does

- Uses your existing project directory
- Sets up SST configuration for ${config.framework}
- Deploys to AWS region: ${config.region}
- ${config.userDistribution === 'worldwide' ? 'Sets up global CDN' : 'Regional deployment'}
- ${config.customDomain?.enabled ? 'Configures custom domain: ' + config.customDomain.domain : 'Uses AWS-generated URLs'}

## Manual Deployment

If you prefer manual control:

\`\`\`bash
# 1. Copy sst.config.ts to your project root

# 2. Install dependencies
npm install
npm install sst@latest

# 3. Deploy
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
