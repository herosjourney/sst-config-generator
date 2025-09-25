#!/bin/bash

echo "🚀 Setting up SST Config Generator..."
echo ""

# Create directory structure
echo "📁 Creating directory structure..."
mkdir -p components lib pages/api/auth "pages/api/analyze/[owner]" pages/api/configs styles types

# Create package.json
echo "📦 Creating package.json..."
cat > package.json << 'EOF'
{
  "name": "sst-config-generator",
  "version": "0.1.0",
  "private": true,
  "scripts": {
    "dev": "next dev",
    "build": "next build",
    "start": "next start",
    "lint": "next lint"
  },
  "dependencies": {
    "next": "14.0.0",
    "react": "^18",
    "react-dom": "^18",
    "next-auth": "^4.24.5",
    "@octokit/rest": "^20.0.2",
    "@anthropic-ai/sdk": "^0.24.3",
    "archiver": "^6.0.1",
    "lucide-react": "^0.294.0",
    "tailwindcss": "^3.3.0",
    "autoprefixer": "^10.0.1",
    "postcss": "^8",
    "@types/node": "^20",
    "@types/react": "^18",
    "@types/react-dom": "^18",
    "typescript": "^5"
  },
  "devDependencies": {
    "eslint": "^8",
    "eslint-config-next": "14.0.0"
  }
}
EOF

# Create tsconfig.json
echo "⚙️ Creating tsconfig.json..."
cat > tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "es5",
    "lib": ["dom", "dom.iterable", "es6"],
    "allowJs": true,
    "skipLibCheck": true,
    "strict": true,
    "forceConsistentCasingInFileNames": true,
    "noEmit": true,
    "esModuleInterop": true,
    "module": "esnext",
    "moduleResolution": "node",
    "resolveJsonModule": true,
    "isolatedModules": true,
    "jsx": "preserve",
    "incremental": true,
    "plugins": [{ "name": "next" }],
    "paths": { "@/*": ["./*"] }
  },
  "include": ["next-env.d.ts", "**/*.ts", "**/*.tsx", ".next/types/**/*.ts"],
  "exclude": ["node_modules"]
}
EOF

# Create tailwind.config.js
echo "🎨 Creating tailwind.config.js..."
cat > tailwind.config.js << 'EOF'
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {},
  },
  plugins: [],
}
EOF

# Create postcss.config.js
echo "🔧 Creating postcss.config.js..."
cat > postcss.config.js << 'EOF'
module.exports = {
  plugins: {
    tailwindcss: {},
    autoprefixer: {},
  },
}
EOF

# Create next.config.js
echo "⚡ Creating next.config.js..."
cat > next.config.js << 'EOF'
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
}

module.exports = nextConfig
EOF

# Create types/index.ts
echo "📝 Creating types/index.ts..."
cat > types/index.ts << 'EOF'
export interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description?: string;
  language?: string;
}

export interface ProjectAnalysis {
  type: 'SSR' | 'CSR' | 'STATIC';
  framework: string;
  buildCommand?: string;
  outputDir: string;
  packageJson?: any;
  hasDockerfile?: boolean;
  dependencies: string[];
  confidence?: number;
}

export interface DeploymentConfig {
  projectName: string;
  framework: string;
  projectType: 'SSR' | 'CSR' | 'STATIC';
  region: string;
  customDomain?: {
    enabled: boolean;
    domain?: string;
  };
  performance: 'instant' | 'fast' | 'reasonable';
  userDistribution: 'single' | 'regional' | 'worldwide';
  expectedUsers: '<100' | '100-1000' | '1000-10000' | '>10000';
  buildCommand?: string;
  outputDir: string;
}

export interface SavedConfig {
  id: string;
  name: string;
  repository: string;
  config: DeploymentConfig;
  createdAt: string;
  updatedAt: string;
}
EOF

# Create lib/claude-analyzer.ts
echo "🤖 Creating lib/claude-analyzer.ts..."
cat > lib/claude-analyzer.ts << 'EOF'
import Anthropic from '@anthropic-ai/sdk';
import { ProjectAnalysis } from '../types';

export class ClaudeAnalyzer {
  private anthropic: Anthropic;

  constructor() {
    this.anthropic = new Anthropic({
      apiKey: process.env.ANTHROPIC_API_KEY!,
    });
  }

  async analyzeRepository(repoData: {
    packageJson?: string;
    rootFiles: string[];
    srcFiles: string[];
    configFiles: Record<string, string>;
  }): Promise<ProjectAnalysis> {
    
    const prompt = this.buildAnalysisPrompt(repoData);
    
    try {
      const response = await this.anthropic.messages.create({
        model: 'claude-3-5-sonnet-20241022',
        max_tokens: 2000,
        messages: [{
          role: 'user',
          content: prompt
        }]
      });

      const analysisText = response.content[0].type === 'text' ? response.content[0].text : '';
      return this.parseAnalysisResponse(analysisText);
    } catch (error) {
      console.error('Claude API error:', error);
      throw new Error('Failed to analyze repository with Claude');
    }
  }

  private buildAnalysisPrompt(repoData: {
    packageJson?: string;
    rootFiles: string[];
    srcFiles: string[];
    configFiles: Record<string, string>;
  }): string {
    return `
You are an expert at analyzing JavaScript/TypeScript repositories to detect their framework and project type. 

Analyze this repository and return a JSON response with the project analysis:

**Repository Files:**
Root files: ${repoData.rootFiles.join(', ')}
Src files: ${repoData.srcFiles.join(', ')}

**Package.json:**
${repoData.packageJson || 'None found'}

**Config Files:**
${Object.entries(repoData.configFiles).map(([file, content]) => 
  `${file}:\n${content.slice(0, 500)}...`
).join('\n\n')}

**Detection Rules:**
1. SSR Frameworks (highest priority):
   - Next.js: has "next" dependency OR next.config.js/ts
   - Nuxt: has "nuxt" dependency OR nuxt.config.js/ts  
   - SvelteKit: has "@sveltejs/kit" dependency OR svelte.config.js
   - Remix: has "@remix-run/node" OR remix.config.js

2. CSR Frameworks:
   - React SPA: has "react" + "react-dom" but NOT Next.js/Remix/Gatsby
   - Vue SPA: has "vue" but NOT Nuxt
   - Angular: has "@angular/core"

3. Static Site Generators:
   - Gatsby: has "gatsby" dependency
   - 11ty: has "@11ty/eleventy" dependency  
   - Jekyll: has _config.yml or Gemfile
   - Hugo: has config.toml/yaml

4. Pure Static: has index.html but no framework dependencies

**Return this exact JSON format:**
{
  "type": "SSR|CSR|STATIC",
  "framework": "Next.js|React SPA|Vue SPA|Angular|Nuxt|SvelteKit|Remix|Gatsby|11ty|Jekyll|Hugo|Static HTML",
  "buildCommand": "npm run build|gatsby build|null",
  "outputDir": ".next|build|dist|public|_site|.",
  "dependencies": ["list", "of", "key", "dependencies"],
  "confidence": 0.95
}

Analyze the repository data and respond with ONLY the JSON, no other text.
`;
  }

  private parseAnalysisResponse(response: string): ProjectAnalysis {
    try {
      const jsonMatch = response.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        throw new Error('No JSON found in Claude response');
      }

      const analysis = JSON.parse(jsonMatch[0]);
      
      if (!analysis.type || !analysis.framework) {
        throw new Error('Invalid analysis response from Claude');
      }

      return {
        type: analysis.type,
        framework: analysis.framework,
        buildCommand: analysis.buildCommand === 'null' ? undefined : analysis.buildCommand,
        outputDir: analysis.outputDir || 'dist',
        dependencies: analysis.dependencies || [],
        confidence: analysis.confidence || 0.8
      };
    } catch (error) {
      console.error('Failed to parse Claude response:', error);
      throw new Error('Invalid response format from Claude API');
    }
  }
}
EOF

# Create lib/github.ts
echo "🐙 Creating lib/github.ts..."
cat > lib/github.ts << 'EOF'
import { Octokit } from '@octokit/rest';
import { ClaudeAnalyzer } from './claude-analyzer';
import { ProjectAnalysis, Repository } from '../types';

export class GitHubAnalyzer {
  private octokit: Octokit;
  private claudeAnalyzer: ClaudeAnalyzer;

  constructor(accessToken: string) {
    this.octokit = new Octokit({
      auth: accessToken,
    });
    this.claudeAnalyzer = new ClaudeAnalyzer();
  }

  async getRepositories(): Promise<Repository[]> {
    const { data } = await this.octokit.repos.listForAuthenticatedUser({
      sort: 'updated',
      per_page: 100,
    });
    return data;
  }

  async getFileContent(owner: string, repo: string, path: string): Promise<string | null> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      });
      
      if ('content' in data) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
      return null;
    } catch (error) {
      return null;
    }
  }

  async getDirectoryContents(owner: string, repo: string, path: string = ''): Promise<string[]> {
    try {
      const { data } = await this.octokit.repos.getContent({
        owner,
        repo,
        path,
      });
      
      if (Array.isArray(data)) {
        return data.map(item => item.name);
      }
      return [];
    } catch (error) {
      return [];
    }
  }

  async analyzeProject(owner: string, repo: string): Promise<ProjectAnalysis> {
    try {
      const [packageJsonContent, rootFiles, srcFiles] = await Promise.all([
        this.getFileContent(owner, repo, 'package.json'),
        this.getDirectoryContents(owner, repo),
        this.getDirectoryContents(owner, repo, 'src')
      ]);

      const configFiles: Record<string, string> = {};
      const importantFiles = [
        'next.config.js', 'next.config.ts', 'next.config.mjs',
        'nuxt.config.js', 'nuxt.config.ts',
        'svelte.config.js', 'svelte.config.ts',
        'remix.config.js', 'remix.config.ts',
        'vue.config.js', 'vite.config.js', 'vite.config.ts',
        'angular.json', 'gatsby-config.js',
        '.eleventy.js', 'eleventy.config.js',
        '_config.yml', 'config.toml', 'config.yaml'
      ];

      for (const file of importantFiles) {
        if (rootFiles.includes(file)) {
          const content = await this.getFileContent(owner, repo, file);
          if (content) {
            configFiles[file] = content;
          }
        }
      }

      const repoData = {
        packageJson: packageJsonContent,
        rootFiles,
        srcFiles,
        configFiles
      };

      return await this.claudeAnalyzer.analyzeRepository(repoData);
    } catch (error) {
      console.error('Repository analysis failed:', error);
      throw new Error('Failed to analyze repository');
    }
  }
}
EOF

# Create lib/sst-generator.ts
echo "⚡ Creating lib/sst-generator.ts..."
cat > lib/sst-generator.ts << 'EOF'
import { DeploymentConfig } from '../types';

export class SSTGenerator {
  generateConfig(config: DeploymentConfig): { 'sst.config.ts': string; 'package.json': string } {
    const sstConfig = this.generateSSTConfig(config);
    const packageJson = this.generatePackageJson(config);
    
    return {
      'sst.config.ts': sstConfig,
      'package.json': packageJson
    };
  }

  private generateSSTConfig(config: DeploymentConfig): string {
    const { projectType } = config;

    if (projectType === 'SSR') {
      return this.generateSSRConfig(config);
    } else if (projectType === 'CSR') {
      return this.generateCSRConfig(config);
    } else {
      return this.generateStaticConfig(config);
    }
  }

  private generateSSRConfig(config: DeploymentConfig): string {
    const { projectName, region, customDomain, framework } = config;
    
    let constructType = 'NextjsSite';
    if (framework === 'Nuxt') constructType = 'SvelteKitSite';
    if (framework === 'SvelteKit') constructType = 'SvelteKitSite';
    if (framework === 'Remix') constructType = 'RemixSite';

    return `import { SSTConfig } from "sst";
import { ${constructType} } from "sst/constructs";

export default {
  config(_input) {
    return {
      name: "${projectName}",
      region: "${region}",
    };
  },
  stacks(app) {
    app.stack(function Site({ stack }) {
      const site = new ${constructType}(stack, "${projectName}", {${customDomain?.enabled ? `
        customDomain: {
          domainName: "${customDomain.domain}",
        },` : ''}
        environment: {
          // Add your environment variables here
        },
      });

      stack.addOutputs({
        SiteUrl: site.url,
      });
    });
  },
} satisfies SSTConfig;`;
  }

  private generateCSRConfig(config: DeploymentConfig): string {
    const { projectName, region, customDomain, buildCommand, outputDir, userDistribution } = config;
    
    const needsCloudFront = userDistribution === 'worldwide' || userDistribution === 'regional';

    return `import { SSTConfig } from "sst";
import { StaticSite } from "sst/constructs";

export default {
  config(_input) {
    return {
      name: "${projectName}",
      region: "${region}",
    };
  },
  stacks(app) {
    app.stack(function Site({ stack }) {
      const site = new StaticSite(stack, "${projectName}", {
        path: ".",
        buildCommand: "${buildCommand}",
        buildOutput: "${outputDir}",${customDomain?.enabled ? `
        customDomain: {
          domainName: "${customDomain.domain}",
        },` : ''}${needsCloudFront ? `
        // CloudFront distribution for global users
        environment: {
          // Add your environment variables here
        },` : ''}
      });

      stack.addOutputs({
        SiteUrl: site.url,
      });
    });
  },
} satisfies SSTConfig;`;
  }

  private generateStaticConfig(config: DeploymentConfig): string {
    const { projectName, region, customDomain, buildCommand, outputDir, userDistribution, performance } = config;
    
    const needsCloudFront = userDistribution === 'worldwide';
    const aggressiveCaching = performance === 'instant';

    return `import { SSTConfig } from "sst";
import { StaticSite } from "sst/constructs";

export default {
  config(_input) {
    return {
      name: "${projectName}",
      region: "${region}",
    };
  },
  stacks(app) {
    app.stack(function Site({ stack }) {
      const site = new StaticSite(stack, "${projectName}", {
        path: ".",${buildCommand ? `
        buildCommand: "${buildCommand}",` : ''}
        buildOutput: "${outputDir}",${customDomain?.enabled ? `
        customDomain: {
          domainName: "${customDomain.domain}",
        },` : ''}${aggressiveCaching ? `
        // Optimized for instant loading
        s3Bucket: {
          cors: [
            {
              allowedOrigins: ["*"],
              allowedHeaders: ["*"],
              allowedMethods: ["GET", "HEAD"],
            },
          ],
        },` : ''}
      });

      stack.addOutputs({
        SiteUrl: site.url,
      });
    });
  },
} satisfies SSTConfig;`;
  }

  private generatePackageJson(config: DeploymentConfig): string {
    const basePackageJson = {
      name: config.projectName,
      version: "0.1.0",
      scripts: {
        dev: "sst dev",
        build: "sst build",
        deploy: "sst deploy",
        remove: "sst remove"
      },
      devDependencies: {
        sst: "^3.0.0",
        aws: "^2.1000.0"
      }
    };

    return JSON.stringify(basePackageJson, null, 2);
  }
}
EOF

# Create pages/api/auth/[...nextauth].ts
echo "🔐 Creating NextAuth API route..."
cat > "pages/api/auth/[...nextauth].ts" << 'EOF'
import NextAuth from 'next-auth'
import GithubProvider from 'next-auth/providers/github'

export default NextAuth({
  providers: [
    GithubProvider({
      clientId: process.env.GITHUB_CLIENT_ID!,
      clientSecret: process.env.GITHUB_CLIENT_SECRET!,
      authorization: {
        params: {
          scope: 'repo'
        }
      }
    })
  ],
  callbacks: {
    async jwt({ token, account }) {
      if (account) {
        token.accessToken = account.access_token
      }
      return token
    },
    async session({ session, token }) {
      session.accessToken = token.accessToken as string
      return session
    }
  }
})
EOF

# Create pages/api/repositories.ts
echo "📂 Creating repositories API route..."
cat > pages/api/repositories.ts << 'EOF'
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { GitHubAnalyzer } from '../../lib/github'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, {})
  
  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const analyzer = new GitHubAnalyzer(session.accessToken as string)
    const repositories = await analyzer.getRepositories()
    res.json(repositories)
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch repositories' })
  }
}
EOF

# Create pages/api/analyze/[owner]/[repo].ts
echo "🔍 Creating analyze API route..."
cat > "pages/api/analyze/[owner]/[repo].ts" << 'EOF'
import { NextApiRequest, NextApiResponse } from 'next'
import { getServerSession } from 'next-auth/next'
import { GitHubAnalyzer } from '../../../../lib/github'

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const session = await getServerSession(req, res, {})
  
  if (!session?.accessToken) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  const { owner, repo } = req.query

  try {
    const analyzer = new GitHubAnalyzer(session.accessToken as string)
    const analysis = await analyzer.analyzeProject(owner as string, repo as string)
    res.json(analysis)
  } catch (error) {
    res.status(500).json({ error: 'Failed to analyze repository' })
  }
}
EOF

# Create pages/api/generate-config.ts
echo "⚙️ Creating config generation API route..."
cat > pages/api/generate-config.ts << 'EOF'
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
EOF

# Create pages/api/configs/index.ts
echo "💾 Creating configs API route..."
cat > pages/api/configs/index.ts << 'EOF'
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
EOF

# Create components/RepositorySelector.tsx
echo "📦 Creating RepositorySelector component..."
cat > components/RepositorySelector.tsx << 'EOF'
import { useState, useEffect } from 'react'
import { Repository } from '../types'

interface RepositorySelectorProps {
  onSelect: (repo: Repository) => void
}

export default function RepositorySelector({ onSelect }: RepositorySelectorProps) {
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loading, setLoading] = useState(false)
  const [search, setSearch] = useState('')

  useEffect(() => {
    fetchRepositories()
  }, [])

  const fetchRepositories = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/repositories')
      const data = await response.json()
      setRepositories(data)
    } catch (error) {
      console.error('Failed to fetch repositories:', error)
    } finally {
      setLoading(false)
    }
  }

  const filteredRepos = repositories.filter(repo =>
    repo.name.toLowerCase().includes(search.toLowerCase()) ||
    repo.description?.toLowerCase().includes(search.toLowerCase())
  )

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading repositories...</span>
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

      {filteredRepos.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          No repositories found matching your search.
        </div>
      )}
    </div>
  )
}
EOF

# Create components/ContextQuestions.tsx
echo "❓ Creating ContextQuestions component..."
cat > components/ContextQuestions.tsx << 'EOF'
import { useState } from 'react'
import { DeploymentConfig } from '../types'

interface ContextQuestionsProps {
  onComplete: (config: Partial<DeploymentConfig>) => void
  projectName: string
}

export default function ContextQuestions({ onComplete, projectName }: ContextQuestionsProps) {
  const [userDistribution, setUserDistribution] = useState<'single' | 'regional' | 'worldwide'>('single')
  const [expectedUsers, setExpectedUsers] = useState<'<100' | '100-1000' | '1000-10000' | '>10000'>('<100')
  const [customDomain, setCustomDomain] = useState(false)
  const [domain, setDomain] = useState('')
  const [performance, setPerformance] = useState<'instant' | 'fast' | 'reasonable'>('fast')
  const [region, setRegion] = useState('us-east-1')

  const handleSubmit = () => {
    const config: Partial<DeploymentConfig> = {
      userDistribution,
      expectedUsers,
      customDomain: customDomain ? { enabled: true, domain } : { enabled: false },
      performance,
      region
    }
    onComplete(config)
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-900">Configure Deployment</h2>
        <p className="text-gray-600">for {projectName}</p>
      </div>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Where are your users located?
          </label>
          <div className="space-y-2">
            {[
              { value: 'single', label: 'Mainly in one country', desc: 'Lower cost, single region deployment' },
              { value: 'regional', label: 'Multiple countries (same region)', desc: 'Regional optimization' },
              { value: 'worldwide', label: 'Worldwide', desc: 'Global CDN for best performance' }
            ].map((option) => (
              <label key={option.value} className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="distribution"
                  value={option.value}
                  checked={userDistribution === option.value}
                  onChange={(e) => setUserDistribution(e.target.value as any)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-gray-500">{option.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        {userDistribution === 'single' && (
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-3">
              Select your primary region
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
            >
              <option value="us-east-1">US East (N. Virginia)</option>
              <option value="us-west-2">US West (Oregon)</option>
              <option value="eu-west-1">Europe (Ireland)</option>
              <option value="ap-southeast-1">Asia Pacific (Singapore)</option>
            </select>
          </div>
        )}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Expected concurrent users during busy periods?
          </label>
          <div className="space-y-2">
            {[
              { value: '<100', label: '< 100 users', desc: 'Basic hosting setup' },
              { value: '100-1000', label: '100-1,000 users', desc: 'Optimized for medium traffic' },
              { value: '1000-10000', label: '1,000-10,000 users', desc: 'High-performance setup' },
              { value: '>10000', label: '> 10,000 users', desc: 'Enterprise-grade infrastructure' }
            ].map((option) => (
              <label key={option.value} className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="users"
                  value={option.value}
                  checked={expectedUsers === option.value}
                  onChange={(e) => setExpectedUsers(e.target.value as any)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-gray-500">{option.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Custom domain
          </label>
          <div className="space-y-3">
            <label className="flex items-center space-x-3 cursor-pointer">
              <input
                type="checkbox"
                checked={customDomain}
                onChange={(e) => setCustomDomain(e.target.checked)}
              />
              <span>I want to use a custom domain (like mysite.com)</span>
            </label>
            
            {customDomain && (
              <input
                type="text"
                placeholder="Enter your domain (e.g., mysite.com)"
                value={domain}
                onChange={(e) => setDomain(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
              />
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-3">
            Performance priority
          </label>
          <div className="space-y-2">
            {[
              { value: 'instant', label: 'Must load instantly (< 1 second)', desc: 'Aggressive caching and optimization' },
              { value: 'fast', label: 'Should be fast (1-2 seconds)', desc: 'Standard optimization' },
              { value: 'reasonable', label: 'Reasonable speed OK (2-3+ seconds)', desc: 'Basic setup, lower cost' }
            ].map((option) => (
              <label key={option.value} className="flex items-start space-x-3 cursor-pointer">
                <input
                  type="radio"
                  name="performance"
                  value={option.value}
                  checked={performance === option.value}
                  onChange={(e) => setPerformance(e.target.value as any)}
                  className="mt-1"
                />
                <div>
                  <div className="font-medium">{option.label}</div>
                  <div className="text-sm text-gray-500">{option.desc}</div>
                </div>
              </label>
            ))}
          </div>
        </div>

        <button
          onClick={handleSubmit}
          className="w-full bg-blue-600 text-white py-3 px-4 rounded-lg hover:bg-blue-700 font-medium"
        >
          Generate SST Configuration
        </button>
      </div>
    </div>
  )
}
EOF

# Create components/ConfigResult.tsx
echo "✅ Creating ConfigResult component..."
cat > components/ConfigResult.tsx << 'EOF'
import { useState } from 'react'
import { DeploymentConfig } from '../types'
import { Download, Save, Copy } from 'lucide-react'

interface ConfigResultProps {
  config: DeploymentConfig
  onSave?: (name: string) => void
}

export default function ConfigResult({ config, onSave }: ConfigResultProps) {
  const [saving, setSaving] = useState(false)
  const [configName, setConfigName] = useState(config.projectName)
  const [showSaveModal, setShowSaveModal] = useState(false)

  const downloadConfig = async () => {
    try {
      const response = await fetch('/api/generate-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config)
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${config.projectName}-sst-config.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  const saveConfig = async () => {
    if (!onSave) return
    
    setSaving(true)
    try {
      await onSave(configName)
      setShowSaveModal(false)
    } catch (error) {
      console.error('Save failed:', error)
    } finally {
      setSaving(false)
    }
  }

  const copyInstructions = () => {
    const instructions = `# SST Deployment Instructions

## Prerequisites
1. Install SST: npm install -g sst
2. Configure AWS CLI with your credentials
3. Ensure you have the necessary AWS permissions

## Setup Steps
1. Extract the downloaded files to your project root
2. Install dependencies: npm install
3. Deploy to AWS: sst deploy --stage production

## Your Configuration
- Project: ${config.projectName}
- Type: ${config.projectType}
- Framework: ${config.framework}
- Region: ${config.region}
- Custom Domain: ${config.customDomain?.enabled ? config.customDomain.domain : 'No'}
- Performance: ${config.performance}
- User Distribution: ${config.userDistribution}
`
    navigator.clipboard.writeText(instructions)
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div className="bg-green-50 border border-green-200 rounded-lg p-6">
        <div className="flex items-center space-x-2 mb-4">
          <div className="w-8 h-8 bg-green-600 rounded-full flex items-center justify-center">
            <span className="text-white text-sm font-bold">✓</span>
          </div>
          <h2 className="text-xl font-bold text-green-800">SST Configuration Generated!</h2>
        </div>
        
        <div className="grid md:grid-cols-2 gap-6">
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">Configuration Summary</h3>
            <ul className="space-y-1 text-sm">
              <li><span className="font-medium">Project:</span> {config.projectName}</li>
              <li><span className="font-medium">Type:</span> {config.projectType}</li>
              <li><span className="font-medium">Framework:</span> {config.framework}</li>
              <li><span className="font-medium">Region:</span> {config.region}</li>
              <li><span className="font-medium">Custom Domain:</span> {config.customDomain?.enabled ? config.customDomain.domain : 'No'}</li>
              <li><span className="font-medium">Performance:</span> {config.performance}</li>
              <li><span className="font-medium">User Distribution:</span> {config.userDistribution}</li>
            </ul>
          </div>
          
          <div>
            <h3 className="font-semibold text-gray-900 mb-2">What's Included</h3>
            <ul className="space-y-1 text-sm">
              <li>• sst.config.ts (main configuration)</li>
              <li>• Updated package.json with SST dependencies</li>
              <li>• Step-by-step deployment instructions</li>
              <li>• AWS resource configuration</li>
              {config.customDomain?.enabled && <li>• Domain and SSL setup</li>}
              {config.userDistribution === 'worldwide' && <li>• CloudFront CDN configuration</li>}
            </ul>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 justify-center">
        <button
          onClick={downloadConfig}
          className="flex items-center space-x-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 font-medium"
        >
          <Download size={20} />
          <span>Download Configuration</span>
        </button>
        
        {onSave && (
          <button
            onClick={() => setShowSaveModal(true)}
            className="flex items-center space-x-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 font-medium"
          >
            <Save size={20} />
            <span>Save Configuration</span>
          </button>
        )}
        
        <button
          onClick={copyInstructions}
          className="flex items-center space-x-2 bg-gray-600 text-white px-6 py-3 rounded-lg hover:bg-gray-700 font-medium"
        >
          <Copy size={20} />
          <span>Copy Instructions</span>
        </button>
      </div>

      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold mb-4">Save Configuration</h3>
            <input
              type="text"
              value={configName}
              onChange={(e) => setConfigName(e.target.value)}
              placeholder="Configuration name"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 mb-4"
            />
            <div className="flex space-x-3">
              <button
                onClick={saveConfig}
                disabled={saving || !configName.trim()}
                className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button
                onClick={() => setShowSaveModal(false)}
                className="flex-1 bg-gray-300 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-400"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
EOF

# Create components/SavedConfigs.tsx
echo "💾 Creating SavedConfigs component..."
cat > components/SavedConfigs.tsx << 'EOF'
import { useState, useEffect } from 'react'
import { SavedConfig } from '../types'
import { Download, Trash2 } from 'lucide-react'

export default function SavedConfigs() {
  const [configs, setConfigs] = useState<SavedConfig[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchConfigs()
  }, [])

  const fetchConfigs = async () => {
    try {
      const response = await fetch('/api/configs')
      const data = await response.json()
      setConfigs(data)
    } catch (error) {
      console.error('Failed to fetch configs:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadConfig = async (config: SavedConfig) => {
    try {
      const response = await fetch('/api/generate-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(config.config)
      })

      if (response.ok) {
        const blob = await response.blob()
        const url = window.URL.createObjectURL(blob)
        const a = document.createElement('a')
        a.href = url
        a.download = `${config.name}-sst-config.zip`
        document.body.appendChild(a)
        a.click()
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }
    } catch (error) {
      console.error('Download failed:', error)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
        <span className="ml-2">Loading saved configurations...</span>
      </div>
    )
  }

  if (configs.length === 0) {
    return (
      <div className="text-center py-12">
        <h3 className="text-lg font-medium text-gray-900 mb-2">No saved configurations</h3>
        <p className="text-gray-600">Create and save your first SST configuration to see it here.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <h2 className="text-2xl font-bold text-gray-900">Saved Configurations</h2>
      
      <div className="grid gap-4">
        {configs.map((config) => (
          <div key={config.id} className="border border-gray-200 rounded-lg p-4 hover:border-gray-300">
            <div className="flex items-start justify-between">
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900">{config.name}</h3>
                <p className="text-sm text-gray-600 mb-2">{config.repository}</p>
                
                <div className="flex flex-wrap gap-2 text-xs">
                  <span className="px-2 py-1 bg-blue-100 text-blue-700 rounded">
                    {config.config.framework}
                  </span>
                  <span className="px-2 py-1 bg-green-100 text-green-700 rounded">
                    {config.config.region}
                  </span>
                  {config.config.customDomain?.enabled && (
                    <span className="px-2 py-1 bg-purple-100 text-purple-700 rounded">
                      Custom Domain
                    </span>
                  )}
                </div>
                
                <p className="text-xs text-gray-500 mt-2">
                  Created: {new Date(config.createdAt).toLocaleDateString()}
                </p>
              </div>
              
              <div className="flex space-x-2">
                <button
                  onClick={() => downloadConfig(config)}
                  className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg"
                  title="Download configuration"
                >
                  <Download size={16} />
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
EOF

# Create pages/index.tsx
echo "🏠 Creating main page..."
cat > pages/index.tsx << 'EOF'
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
      
      if (analysisData.type === 'STATIC') {
        setCurrentStep('questions')
      } else {
        const config: DeploymentConfig = {
          projectName: repo.name,
          framework: analysisData.framework,
          projectType: analysisData.type,
          region: 'us-east-1',
          customDomain: { enabled: false },
          performance: 'fast',
          userDistribution: 'single',
          expectedUsers: '<100',
          buildCommand: analysisData.buildCommand,
          outputDir: analysisData.outputDir
        }
        setFinalConfig(config)
        setCurrentStep('result')
      }
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
              <h1 className="text-4xl font-bold text-gray-900 mb-4">
                SST Configuration Generator
              </h1>
              <p className="text-xl text-gray-600 max-w-2xl mx-auto">
                Automatically analyze your GitHub repositories and generate optimized SST configurations for AWS deployment
              </p>
            </div>

            <div className="bg-white rounded-lg shadow-lg p-8 max-w-md mx-auto">
              <div className="mb-6">
                <Github size={48} className="mx-auto text-gray-700 mb-4" />
                <h2 className="text-2xl font-semibold text-gray-900 mb-2">Get Started</h2>
                <p className="text-gray-600">
                  Connect your GitHub account to analyze your repositories and generate SST configurations
                </p>
              </div>

              <button
                onClick={() => signIn('github')}
                className="w-full bg-gray-900 text-white py-3 px-4 rounded-lg hover:bg-gray-800 flex items-center justify-center space-x-2 font-medium"
              >
                <Github size={20} />
                <span>Connect GitHub Account</span>
              </button>

              <div className="mt-6 text-sm text-gray-500">
                <p>We only request repository access. Your code stays secure.</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <h1 className="text-2xl font-bold text-gray-900">SST Config Generator</h1>
              
              <nav className="flex space-x-1">
                <button
                  onClick={() => setCurrentStep('repos')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    currentStep === 'repos' || currentStep === 'analysis' || currentStep === 'questions' || currentStep === 'result'
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <Settings size={16} className="inline mr-1" />
                  Generate Config
                </button>
                
                <button
                  onClick={() => setCurrentStep('saved')}
                  className={`px-3 py-2 rounded-lg text-sm font-medium ${
                    currentStep === 'saved' 
                      ? 'bg-blue-100 text-blue-700' 
                      : 'text-gray-600 hover:text-gray-900'
                  }`}
                >
                  <History size={16} className="inline mr-1" />
                  Saved Configs
                </button>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-600">
                {session.user?.name || session.user?.email}
              </span>
              <button
                onClick={() => signOut()}
                className="text-sm text-gray-600 hover:text-gray-900"
              >
                Sign Out
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        {loading && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg p-6 flex items-center space-x-4">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span>Analyzing repository...</span>
            </div>
          </div>
        )}

        {currentStep === 'repos' && (
          <div>
            <div className="mb-8">
              <h2 className="text-3xl font-bold text-gray-900 mb-2">Select Repository</h2>
              <p className="text-gray-600">Choose a repository to analyze and generate SST configuration</p>
            </div>
            <RepositorySelector onSelect={analyzeRepository} />
          </div>
        )}

        {currentStep === 'questions' && selectedRepo && (
          <ContextQuestions
            projectName={selectedRepo.name}
            onComplete={handleQuestionsComplete}
          />
        )}

        {currentStep === 'result' && finalConfig && (
          <div>
            <ConfigResult 
              config={finalConfig} 
              onSave={saveConfiguration}
            />
            
            <div className="text-center mt-8">
              <button
                onClick={resetFlow}
                className="bg-gray-600 text-white px-6 py-2 rounded-lg hover:bg-gray-700"
              >
                Analyze Another Repository
              </button>
            </div>
          </div>
        )}

        {currentStep === 'saved' && (
          <SavedConfigs />
        )}
      </main>
    </div>
  )
}
EOF

# Create pages/_app.tsx
echo "🔗 Creating _app.tsx..."
cat > pages/_app.tsx << 'EOF'
import { SessionProvider } from 'next-auth/react'
import type { AppProps } from 'next/app'
import '../styles/globals.css'

export default function App({
  Component,
  pageProps: { session, ...pageProps },
}: AppProps) {
  return (
    <SessionProvider session={session}>
      <Component {...pageProps} />
    </SessionProvider>
  )
}
EOF

# Create styles/globals.css
echo "🎨 Creating global styles..."
cat > styles/globals.css << 'EOF'
@tailwind base;
@tailwind components;
@tailwind utilities;

html,
body {
  padding: 0;
  margin: 0;
  font-family: -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Oxygen,
    Ubuntu, Cantarell, Fira Sans, Droid Sans, Helvetica Neue, sans-serif;
}

a {
  color: inherit;
  text-decoration: none;
}

* {
  box-sizing: border-box;
}
EOF

# Create .env.local template
echo "🔐 Creating .env.local template..."
cat > .env.local << 'EOF'
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-nextauth-secret-here
GITHUB_CLIENT_ID=your-github-client-id
GITHUB_CLIENT_SECRET=your-github-client-secret
ANTHROPIC_API_KEY=your-anthropic-api-key
EOF

# Create .gitignore
echo "🚫 Creating .gitignore..."
cat > .gitignore << 'EOF'
# Dependencies
node_modules/
.pnpm-debug.log*

# Next.js
.next/
out/

# Production
build/

# Environment files
.env*.local

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*

# Local
.DS_Store
*.log
EOF

echo ""
echo "✅ Setup complete!"
echo ""
echo "📋 Next steps:"
echo "1. Edit .env.local with your real API keys"
echo "2. Run: npm install"
echo "3. Run: npm run dev"
echo "4. Visit: http://localhost:3000"
echo ""
echo "🔑 Don't forget to get your API keys:"
echo "• GitHub OAuth: https://github.com/settings/developers"
echo "• Anthropic API: https://console.anthropic.com"
echo "• NextAuth Secret: openssl rand -base64 32"
echo ""
echo "🎉 Happy coding!"
