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
