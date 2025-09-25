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
