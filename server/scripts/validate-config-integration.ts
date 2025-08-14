#!/usr/bin/env tsx

/**
 * Configuration Integration Validation Script
 * 
 * This script validates that all configuration files are properly integrated
 * with the infrastructure services and the main application.
 */

import { ConfigIntegrationValidator } from '../src/shared/config/config-integration-validator';
import { containerInitializationService } from '../src/shared/container/container-initialization-service';

async function main() {
  console.log('🔍 Starting Configuration Integration Validation...\n');

  try {
    // Test environment variable mapping
    console.log('📋 Validating Environment Variable Mapping...');
    const envValidation = ConfigIntegrationValidator.validateEnvironmentMapping();
    
    if (!envValidation.isValid) {
      console.log('⚠️  Missing Environment Variables:');
      envValidation.missingVars.forEach(envVar => {
        console.log(`   - ${envVar}`);
      });
      console.log('\n💡 Recommendations:');
      envValidation.recommendations.forEach(rec => {
        console.log(`   - ${rec}`);
      });
    } else {
      console.log('✅ All required environment variables are set\n');
    }

    // Initialize container
    console.log('🏗️  Initializing Dependency Injection Container...');
    const container = await containerInitializationService.initialize();
    console.log('✅ Container initialized successfully\n');

    // Validate service integration
    console.log('🔧 Validating Service Integration...');
    const validation = await ConfigIntegrationValidator.validateServiceIntegration(container);

    // Generate and display report
    const report = ConfigIntegrationValidator.generateIntegrationReport(validation);
    console.log(report);

    // Exit with appropriate code
    if (validation.isValid && envValidation.isValid) {
      console.log('🎉 All configuration integrations are working correctly!');
      process.exit(0);
    } else {
      console.log('❌ Configuration integration issues found. Please review and fix.');
      process.exit(1);
    }

  } catch (error) {
    console.error('💥 Critical error during validation:', error);
    process.exit(1);
  }
}

main().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
