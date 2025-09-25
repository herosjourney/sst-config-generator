export interface Repository {
  id: number;
  name: string;
  full_name: string;
  private: boolean;
  html_url: string;
  description?: string | null;
  language?: string | null; 
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
  // Simplified to just what matters
  userDistribution: 'single' | 'worldwide';
  buildCommand?: string;
  outputDir: string;
  // Auto-set smart defaults
  performance: 'fast'; // Good default
  expectedUsers: '<100'; // Most sites start small
}

export interface SavedConfig {
  id: string;
  name: string;
  repository: string;
  config: DeploymentConfig;
  createdAt: string;
  updatedAt: string;
}
