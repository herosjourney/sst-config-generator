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
    const { 
      projectName, 
      region, 
      customDomain, 
      framework,
      userDistribution
    } = config;
    
    let constructType = 'NextjsSite';
    if (framework === 'Nuxt') constructType = 'SvelteKitSite';
    if (framework === 'SvelteKit') constructType = 'SvelteKitSite';
    if (framework === 'Remix') constructType = 'RemixSite';

    const needsGlobalCDN = userDistribution === 'worldwide';

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
        },` : ''}${needsGlobalCDN ? `
        
        // Global CDN for worldwide users
        edge: {
          // Automatic global distribution and caching
          viewerProtocolPolicy: "redirect-to-https",
        },` : ''}
        
        // Smart defaults for optimal performance
        runtime: {
          // Balanced memory for good performance
          memory: "1024 MB",
          timeout: "10 seconds",
        },
        
        environment: {
          // Add your environment variables here
          NODE_ENV: "production",
        },
      });

      stack.addOutputs({
        SiteUrl: site.url,
      });
    });
  },
} satisfies SSTConfig;

// Configuration Summary:
// • Framework: ${framework} (Server-Side Rendered)
// • Distribution: ${needsGlobalCDN ? 'Global CDN' : 'Regional'}
// • Custom Domain: ${customDomain?.enabled ? customDomain.domain : 'Default AWS URL'}
// • Estimated Cost: ${this.estimateCost(config)}/month`;
  }

  private generateCSRConfig(config: DeploymentConfig): string {
    const { 
      projectName, 
      region, 
      customDomain, 
      buildCommand, 
      outputDir, 
      userDistribution
    } = config;
    
    const needsGlobalCDN = userDistribution === 'worldwide';

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
        },` : ''}${needsGlobalCDN ? `
        
        // Global CloudFront CDN for worldwide users
        cloudFrontDistribution: {
          defaultBehavior: {
            // Smart caching and compression
            cachePolicy: "CachingOptimized",
            compress: true,
            viewerProtocolPolicy: "redirect-to-https",
          },
          // Optimized caching for different file types
          additionalBehaviors: {
            "/static/*": {
              // Long cache for static assets
              cachePolicy: "CachingOptimized",
              compress: true,
            },
            "*.css": {
              cachePolicy: "CachingOptimized",
              compress: true,
            },
            "*.js": {
              cachePolicy: "CachingOptimized", 
              compress: true,
            },
          },
        },` : ''}
        
        environment: {
          // Add your runtime environment variables here
          REACT_APP_ENV: "production",
        },
      });

      stack.addOutputs({
        SiteUrl: site.url,${needsGlobalCDN ? `
        CDNUrl: site.cloudFrontDistribution?.distributionDomainName,` : ''}
      });
    });
  },
} satisfies SSTConfig;

// Configuration Summary:
// • Type: ${config.framework} (Client-Side Rendered)
// • Distribution: ${needsGlobalCDN ? 'Global CDN' : 'Regional'}  
// • Custom Domain: ${customDomain?.enabled ? customDomain.domain : 'Default AWS URL'}
// • Estimated Cost: ${this.estimateCost(config)}/month`;
  }

  private generateStaticConfig(config: DeploymentConfig): string {
    const { 
      projectName, 
      region, 
      customDomain, 
      buildCommand, 
      outputDir, 
      userDistribution
    } = config;
    
    const needsGlobalCDN = userDistribution === 'worldwide';
    const hasBuildProcess = buildCommand && buildCommand !== 'null';

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
        path: ".",${hasBuildProcess ? `
        buildCommand: "${buildCommand}",` : ''}
        buildOutput: "${outputDir}",${customDomain?.enabled ? `
        customDomain: {
          domainName: "${customDomain.domain}",
        },` : ''}${needsGlobalCDN ? `
        
        // Global CloudFront CDN for worldwide users
        cloudFrontDistribution: {
          defaultBehavior: {
            // Automatic compression and caching
            cachePolicy: "CachingOptimized",
            compress: true,
            viewerProtocolPolicy: "redirect-to-https",
          },
          // Smart caching for different content types
          additionalBehaviors: {
            "*.html": {
              // Short cache for HTML (content updates)
              cachePolicyId: "4135ea2d-6df8-44a3-9df3-4b5a84be39ad",
            },
            "*.css": {
              // Long cache for CSS (versioned files)
              cachePolicy: "CachingOptimized",
            },
            "*.js": {
              // Long cache for JavaScript (versioned files)
              cachePolicy: "CachingOptimized",
            },
            "*.png,*.jpg,*.jpeg,*.gif,*.ico,*.svg": {
              // Very long cache for images
              cachePolicy: "CachingOptimized",
            },
          },
        },` : ''}
      });

      stack.addOutputs({
        SiteUrl: site.url,${needsGlobalCDN ? `
        CDNUrl: site.cloudFrontDistribution?.distributionDomainName,` : ''}
      });
    });
  },
} satisfies SSTConfig;

// Configuration Summary:
// • Type: ${hasBuildProcess ? 'Generated Static Site' : 'Pure HTML/CSS'}
// • Distribution: ${needsGlobalCDN ? 'Global CDN (faster worldwide)' : 'Regional (lower cost)'}
// • Custom Domain: ${customDomain?.enabled ? customDomain.domain + ' (with free SSL)' : 'Default AWS URL'}
// • Smart Features: Automatic compression, optimized caching, HTTPS
// • Estimated Cost: ${this.estimateCost(config)}/month`;
  }

  private estimateCost(config: DeploymentConfig): string {
    const { userDistribution, projectType } = config;
    
    let baseCost: number;
    
    // Realistic cost estimates
    if (projectType === 'STATIC') {
      baseCost = userDistribution === 'worldwide' ? 5 : 1;
    } else if (projectType === 'CSR') {
      baseCost = userDistribution === 'worldwide' ? 8 : 2;
    } else { // SSR
      baseCost = userDistribution === 'worldwide' ? 15 : 8;
    }
    
    // Add custom domain cost
    if (config.customDomain?.enabled) {
      baseCost += 0.5; // Route53 hosted zone
    }
    
    const lowEnd = Math.max(1, Math.round(baseCost * 0.8));
    const highEnd = Math.round(baseCost * 1.5);
    
    return `$${lowEnd}-${highEnd}`;
  }

  private generatePackageJson(config: DeploymentConfig): string {
    const basePackageJson = {
      name: config.projectName,
      version: "0.1.0",
      scripts: {
        "sst:dev": "sst dev",
        "sst:build": "sst build", 
        "sst:deploy": "sst deploy",
        "sst:deploy:prod": "sst deploy --stage production",
        "sst:remove": "sst remove"
      },
      devDependencies: {
        sst: "^3.0.0"
      }
    };

    return JSON.stringify(basePackageJson, null, 2);
  }
}
