import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';
import os from 'os';
import { SSTGenerator } from './sst-generator';
import {DeploymentConfig} from '../types';

type ProgressCallback = (progress: number, step: string, message: string, deploymentUrl?: string) => void;

export default class AWSDeployBot {
  private repoUrl: string | null = null;
  private projectName: string | null = null;
  private deploymentStage: string = 'development';
  private tempDir: string | null = null;
  private progressCallback?: ProgressCallback;

  async deploy(options: {
    repoUrl: string;
    stage?: string;
    progressCallback?: ProgressCallback;
  }) {
    try {
      this.repoUrl = options.repoUrl;
      this.deploymentStage = options.stage || 'production';
      this.projectName = this.extractProjectName(this.repoUrl);
      this.progressCallback = options.progressCallback;
      
      this.sendProgress(0, 'Starting deployment', '🚀 AWS Deploy Bot Starting...');
      
      // Step-by-step deployment with progress updates
      await this.checkPrerequisites();
      await this.cloneRepository();
      const analysis = await this.detectProjectType();
      await this.installDependencies();
      await this.addSSTConfig(analysis);
      const deploymentUrl = await this.deployToAWS();
      await this.cleanup();
      
      this.sendProgress(100, 'Deployment complete', '✅ Deployment successful!', deploymentUrl);
      
      return { deploymentUrl, projectName: this.projectName };
      
    } catch (error) {
      this.sendProgress(0, 'Deployment failed', `❌ ${error instanceof Error ? error.message : 'Unknown error'}`);
      await this.cleanup();
      throw error;
    }
  }

  private sendProgress(progress: number, step: string, message: string, deploymentUrl?: string) {
    console.log(`[${progress}%] ${message}`);
    if (this.progressCallback) {
      this.progressCallback(progress, step, message, deploymentUrl);
    }
  }

  private extractProjectName(url: string): string {
    return url.split('/').pop()?.replace('.git', '') || 'unknown-project';
  }

  private async checkPrerequisites() {
    this.sendProgress(5, 'Checking prerequisites', '🔍 Checking prerequisites...');
    
    const checks = [
      { cmd: 'git --version', name: 'Git' },
      { cmd: 'node --version', name: 'Node.js' },
      { cmd: 'npm --version', name: 'npm' },
      { cmd: 'aws --version', name: 'AWS CLI' },
      { cmd: 'aws sts get-caller-identity', name: 'AWS credentials' }
    ];

    for (const check of checks) {
      try {
        execSync(check.cmd, { stdio: 'pipe' });
        this.sendProgress(5, 'Checking prerequisites', `✅ ${check.name} is configured`);
      } catch (error) {
        throw new Error(`❌ ${check.name} is not installed or configured`);
      }
    }
  }

  private async cloneRepository() {
    this.sendProgress(15, 'Cloning repository', `📥 Cloning repository: ${this.repoUrl}`);
    
    this.tempDir = path.join(os.tmpdir(), `aws-deploy-${Date.now()}`);
    
    try {
      execSync(`git clone ${this.repoUrl} "${this.tempDir}"`, { 
        stdio: 'pipe' 
      });
      this.sendProgress(25, 'Repository cloned', `✅ Repository cloned successfully`);
    } catch (error) {
      throw new Error(`Failed to clone repository: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async detectProjectType() {
    this.sendProgress(30, 'Analyzing project', '🔍 Detecting project type...');
    
    if (!this.tempDir) throw new Error('No temp directory available');
    
    const packageJsonPath = path.join(this.tempDir, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      const analysis = {
        type: 'STATIC' as const,
        framework: 'Static HTML',
        buildCommand: undefined,
        outputDir: '.',
        dependencies: []
      };
      this.sendProgress(35, 'Project analyzed', '✅ Detected: Static HTML website');
      return analysis;
    }

    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
    const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };

    let analysis;

    // Framework detection logic
    if (deps['next']) {
      analysis = {
        type: 'SSR' as const,
        framework: 'Next.js',
        buildCommand: 'npm run build',
        outputDir: '.next',
        dependencies: Object.keys(deps)
      };
    } else if (deps['react'] && deps['react-dom']) {
      analysis = {
        type: 'CSR' as const,
        framework: 'React SPA',
        buildCommand: 'npm run build',
        outputDir: 'build',
        dependencies: Object.keys(deps)
      };
    } else if (deps['vue']) {
      analysis = {
        type: 'CSR' as const,
        framework: 'Vue SPA',
        buildCommand: 'npm run build',
        outputDir: 'dist',
        dependencies: Object.keys(deps)
      };
    } else if (deps['@angular/core']) {
      analysis = {
        type: 'CSR' as const,
        framework: 'Angular',
        buildCommand: 'ng build',
        outputDir: 'dist',
        dependencies: Object.keys(deps)
      };
    } else {
      analysis = {
        type: 'STATIC' as const,
        framework: 'Static Site',
        buildCommand: packageJson.scripts?.build || undefined,
        outputDir: '.',
        dependencies: Object.keys(deps)
      };
    }

    this.sendProgress(35, 'Project analyzed', `✅ Detected: ${analysis.framework}`);
    return analysis;
  }

  private async installDependencies() {
    if (!this.tempDir) throw new Error('No temp directory available');
    
    const packageJsonPath = path.join(this.tempDir, 'package.json');
    
    if (!fs.existsSync(packageJsonPath)) {
      this.sendProgress(45, 'Skipping dependencies', '⏭️ Skipping dependency installation (static HTML)');
      return;
    }

    this.sendProgress(40, 'Installing dependencies', '📦 Installing dependencies...');
    
    process.chdir(this.tempDir);
    
    try {
      // Install project dependencies
      this.sendProgress(42, 'Installing dependencies', '📦 Installing project dependencies...');
      execSync('npm install', { stdio: 'pipe' });
      
      // Install SST globally
      this.sendProgress(45, 'Installing SST', '⚡ Installing SST...');
      execSync('npm install -g sst@latest', { stdio: 'pipe' });
      
      this.sendProgress(50, 'Dependencies installed', '✅ Dependencies installed');
    } catch (error) {
      throw new Error(`Failed to install dependencies: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async addSSTConfig(analysis: any) {
    this.sendProgress(55, 'Generating SST config', '⚙️ Generating optimized SST configuration...');
    
    if (!this.tempDir || !this.projectName) throw new Error('Missing required data');
    
    // Create deployment config based on analysis
    const deploymentConfig = {
      projectName: this.projectName,
      framework: analysis.framework,
      projectType: analysis.type,
      region: 'us-east-1',
      customDomain: { enabled: false },
      userDistribution: 'worldwide' as const, // This ensures it's treated as a literal
      buildCommand: analysis.buildCommand,
      outputDir: analysis.outputDir,
      performance: 'fast' as const,
      expectedUsers: '<100'
    };

    // Generate SST config using your existing generator
    const generator = new SSTGenerator();
    const { 'sst.config.ts': sstConfig, 'package.json': updatedPackageJson } = generator.generateConfig(deploymentConfig);
    
    // Write SST config
    const configPath = path.join(this.tempDir, 'sst.config.ts');
    fs.writeFileSync(configPath, sstConfig);
    
    // Update package.json with SST scripts
    const packageJsonPath = path.join(this.tempDir, 'package.json');
    if (fs.existsSync(packageJsonPath)) {
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      packageJson.scripts = {
        ...packageJson.scripts,
        'sst:dev': 'sst dev',
        'sst:build': 'sst build',
        'sst:deploy': 'sst deploy',
        'sst:remove': 'sst remove'
      };

      packageJson.devDependencies = {
        ...packageJson.devDependencies,
        'sst': '^3.0.0'
      };
      
      fs.writeFileSync(packageJsonPath, JSON.stringify(packageJson, null, 2));
    }
    
    this.sendProgress(65, 'SST config added', '✅ Optimized SST configuration added');
  }

  private async deployToAWS(): Promise<string> {
    if (!this.tempDir) throw new Error('No temp directory available');
    
    this.sendProgress(70, 'Deploying to AWS', `🚀 Deploying to AWS (stage: ${this.deploymentStage})...`);
    this.sendProgress(72, 'Deploying to AWS', 'This may take 5-10 minutes for the first deployment...');
    
    process.chdir(this.tempDir);
    
    try {
      // Bootstrap SST if needed
      this.sendProgress(75, 'Bootstrapping SST', '⚡ Bootstrapping SST...');
      try {
        execSync('sst bootstrap', { stdio: 'pipe' });
      } catch (error) {
        // Bootstrap might already exist, continue
        this.sendProgress(75, 'SST ready', '✅ SST bootstrap ready');
      }
      
      // Deploy to AWS
      this.sendProgress(80, 'Deploying resources', '🏗️ Creating AWS resources...');
      const deployCmd = `sst deploy --stage ${this.deploymentStage}`;
      const output = execSync(deployCmd, { encoding: 'utf8', stdio: 'pipe' });
      
      // Extract deployment URL from SST output
      const urlMatch = output.match(/SiteUrl:\s+(https?:\/\/[^\s]+)/);
      const deploymentUrl = urlMatch ? urlMatch[1] : `https://${this.projectName}-${this.deploymentStage}.example.com`;
      
      this.sendProgress(95, 'Deployment successful', '🎉 AWS deployment completed!');
      return deploymentUrl;
      
    } catch (error) {
      throw new Error(`Deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  private async cleanup() {
    if (this.tempDir && fs.existsSync(this.tempDir)) {
      this.sendProgress(98, 'Cleaning up', '🧹 Cleaning up temporary files...');
      try {
        // Cross-platform cleanup
        const isWindows = os.platform() === 'win32';
        if (isWindows) {
          execSync(`rmdir /s /q "${this.tempDir}"`, { stdio: 'pipe' });
        } else {
          execSync(`rm -rf "${this.tempDir}"`, { stdio: 'pipe' });
        }
        this.sendProgress(100, 'Cleanup complete', '✅ Cleanup complete');
      } catch (error) {
        console.log('⚠️ Could not clean up temporary directory:', this.tempDir);
      }
    }
  }
}
