import { i18nManager, initializeI18n } from '@taskmanagement/i18n';
import { APIDocumentationGenerator } from './api-documentation-generator';

export interface DocumentationIntegrationConfig {
  apiDocumentation: {
    enabled: boolean;
    outputDir: string;
    formats: ('json' | 'yaml' | 'html')[];
    includeExamples: boolean;
    autoGenerate: boolean;
  };
  localization: {
    enabled: boolean;
    defaultLocale: string;
    fallbackLocale: string;
    translationsPath: string;
    autoLoad: boolean;
  };
}

export class DocumentationIntegration {
  private config: DocumentationIntegrationConfig;
  private apiDocGenerator?: APIDocumentationGenerator;

  constructor(config: Partial<DocumentationIntegrationConfig> = {}) {
    this.config = {
      apiDocumentation: {
        enabled: true,
        outputDir: './docs/api',
        formats: ['json', 'yaml', 'html'],
        includeExamples: true,
        autoGenerate: false,
        ...config.apiDocumentation,
      },
      localization: {
        enabled: true,
        defaultLocale: 'en',
        fallbackLocale: 'en',
        translationsPath: './packages/i18n/src/locales',
        autoLoad: true,
        ...config.localization,
      },
    };
  }

  /**
   * Initialize all documentation and localization systems
   */
  async initialize(): Promise<void> {
    console.log('🚀 Initializing documentation and localization systems...');

    if (this.config.localization.enabled) {
      await this.initializeLocalization();
    }

    if (this.config.apiDocumentation.enabled) {
      await this.initializeApiDocumentation();
    }

    console.log('✅ Documentation and localization systems initialized successfully');
  }

  /**
   * Initialize localization system
   */
  private async initializeLocalization(): Promise<void> {
    console.log('🌐 Initializing localization system...');

    try {
      await initializeI18n({
        defaultLocale: this.config.localization.defaultLocale,
        fallbackLocale: this.config.localization.fallbackLocale,
        translationsPath: this.config.localization.translationsPath,
        autoLoad: this.config.localization.autoLoad,
      });

      // Log available locales
      const availableLocales = i18nManager.getAvailableLocales();
      console.log(
        `📍 Available locales: ${availableLocales.map((locale: any) => locale.code).join(', ')}`
      );
      console.log(`🎯 Default locale: ${this.config.localization.defaultLocale}`);

      // Test translation system
      const testTranslation = i18nManager.t('common.success');
      console.log(`🧪 Test translation: ${testTranslation}`);
    } catch (error) {
      console.error('❌ Failed to initialize localization:', error);
      throw error;
    }
  }

  /**
   * Initialize API documentation system
   */
  private async initializeApiDocumentation(): Promise<void> {
    console.log('📚 Initializing API documentation system...');

    try {
      this.apiDocGenerator = new APIDocumentationGenerator({
        includeExamples: this.config.apiDocumentation.includeExamples,
        includeWebSocket: true,
        outputFormats: this.config.apiDocumentation.formats,
      });

      // Add all endpoints
      this.apiDocGenerator.addTaskEndpoints();
      this.apiDocGenerator.addProjectEndpoints();

      if (this.config.apiDocumentation.autoGenerate) {
        await this.generateApiDocumentation();
      }

      console.log('📖 API documentation system ready');
    } catch (error) {
      console.error('❌ Failed to initialize API documentation:', error);
      throw error;
    }
  }

  /**
   * Generate API documentation
   */
  async generateApiDocumentation(): Promise<void> {
    if (!this.apiDocGenerator) {
      throw new Error('API documentation generator not initialized');
    }

    console.log('🔨 Generating API documentation...');
    await this.apiDocGenerator.generateDocumentation(this.config.apiDocumentation.outputDir);
    console.log(`📂 API documentation generated at: ${this.config.apiDocumentation.outputDir}`);
  }

  /**
   * Get localization statistics
   */
  getLocalizationStats(): Record<string, any> {
    const availableLocales = i18nManager.getAvailableLocales();
    const stats: Record<string, any> = {};

    for (const locale of availableLocales) {
      stats[locale.code] = {
        name: locale.name,
        nativeName: locale.nativeName,
        direction: locale.direction,
        ...i18nManager.getTranslationStats(locale.code),
      };
    }

    return stats;
  }

  /**
   * Get API documentation info
   */
  getApiDocumentationInfo(): any {
    if (!this.apiDocGenerator) {
      return { status: 'not_initialized' };
    }

    const spec = this.apiDocGenerator.getSpec();
    return {
      status: 'initialized',
      title: spec.info?.title,
      version: spec.info?.version,
      description: spec.info?.description,
      endpoints: Object.keys(spec.paths || {}).length,
      schemas: Object.keys(spec.components?.schemas || {}).length,
      outputFormats: this.config.apiDocumentation.formats,
      outputDir: this.config.apiDocumentation.outputDir,
    };
  }

  /**
   * Health check for all systems
   */
  async healthCheck(): Promise<{
    localization: { status: string; details: any };
    apiDocumentation: { status: string; details: any };
  }> {
    const result = {
      localization: { status: 'unknown' as string, details: null as any },
      apiDocumentation: {
        status: 'unknown' as string,
        details: null as any,
      },
    };

    // Check localization system
    try {
      if (this.config.localization.enabled) {
        const testTranslation = i18nManager.t('common.success');
        const availableLocales = i18nManager.getAvailableLocales();

        result.localization = {
          status: testTranslation ? 'healthy' : 'degraded',
          details: {
            currentLocale: i18nManager.getCurrentLocale(),
            availableLocales: availableLocales.length,
            testTranslation,
          },
        };
      } else {
        result.localization = { status: 'disabled', details: null };
      }
    } catch (error) {
      result.localization = {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }

    // Check API documentation system
    try {
      if (this.config.apiDocumentation.enabled && this.apiDocGenerator) {
        const spec = this.apiDocGenerator.getSpec();
        const endpointCount = Object.keys(spec.paths || {}).length;

        result.apiDocumentation = {
          status: endpointCount > 0 ? 'healthy' : 'degraded',
          details: {
            endpoints: endpointCount,
            schemas: Object.keys(spec.components?.schemas || {}).length,
            version: spec.info?.version,
          },
        };
      } else {
        result.apiDocumentation = { status: 'disabled', details: null };
      }
    } catch (error) {
      result.apiDocumentation = {
        status: 'unhealthy',
        details: {
          error: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }

    return result;
  }

  /**
   * Reload localization data
   */
  async reloadLocalization(): Promise<void> {
    console.log('🔄 Reloading localization data...');

    if (this.config.localization.enabled) {
      await this.initializeLocalization();
      console.log('✅ Localization data reloaded');
    } else {
      console.log('⚠️ Localization is disabled');
    }
  }

  /**
   * Regenerate API documentation
   */
  async regenerateApiDocumentation(): Promise<void> {
    console.log('🔄 Regenerating API documentation...');

    if (this.config.apiDocumentation.enabled) {
      await this.initializeApiDocumentation();
      await this.generateApiDocumentation();
      console.log('✅ API documentation regenerated');
    } else {
      console.log('⚠️ API documentation is disabled');
    }
  }

  /**
   * Export system configuration
   */
  exportConfig(): DocumentationIntegrationConfig {
    return JSON.parse(JSON.stringify(this.config));
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<DocumentationIntegrationConfig>): void {
    this.config = {
      apiDocumentation: {
        ...this.config.apiDocumentation,
        ...newConfig.apiDocumentation,
      },
      localization: { ...this.config.localization, ...newConfig.localization },
    };
  }
}

// Export singleton instance
export const documentationIntegration = new DocumentationIntegration();
