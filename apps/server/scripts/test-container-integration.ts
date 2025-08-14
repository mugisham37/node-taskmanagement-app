#!/usr/bin/env tsx

/**
 * Container Integration Test Runner
 * 
 * This script runs comprehensive tests to validate that all container components
 * are properly integrated and the dependency injection system is working correctly.
 */

import { runContainerIntegrationTest } from '../src/shared/container/container-integration-test';

async function main() {
  console.log('🚀 Container Integration Test Runner');
  console.log('====================================\n');

  try {
    const result = await runContainerIntegrationTest();

    console.log('\n🎯 Final Results:');
    console.log('================');
    
    if (result.isSuccess) {
      console.log('🎉 ALL TESTS PASSED! Container is fully integrated and ready for production.');
    } else {
      console.log('❌ TESTS FAILED! Container integration has issues that need to be addressed.');
      console.log('\n🔍 Errors Found:');
      result.errors.forEach((error, index) => {
        console.log(`  ${index + 1}. ${error}`);
      });
    }

    console.log('\n📋 Test Details:');
    result.tests.forEach(test => {
      const icon = test.status === 'PASSED' ? '✅' : test.status === 'FAILED' ? '❌' : '⚠️';
      console.log(`  ${icon} ${test.name}: ${test.message}`);
    });

    console.log('\n📊 Summary:');
    console.log(`  Total Tests: ${result.summary.totalTests}`);
    console.log(`  Passed: ${result.summary.passedTests}`);
    console.log(`  Failed: ${result.summary.failedTests}`);
    console.log(`  Warnings: ${result.summary.warnings}`);
    
    const successRate = result.summary.totalTests > 0 
      ? ((result.summary.passedTests / result.summary.totalTests) * 100).toFixed(1)
      : '0';
    console.log(`  Success Rate: ${successRate}%`);

    console.log('\n💡 Integration Status:');
    if (result.isSuccess) {
      console.log('  🟢 EXCELLENT: All container components are properly integrated');
      console.log('  🔧 The dependency injection system is working perfectly');
      console.log('  🚀 Ready for production deployment');
    } else if (result.summary.failedTests === 0 && result.summary.warnings > 0) {
      console.log('  🟡 GOOD: Core functionality working with minor issues');
      console.log('  ⚠️  Some components need attention but system is functional');
      console.log('  🔧 Address warnings for optimal performance');
    } else {
      console.log('  🔴 ISSUES DETECTED: Critical integration problems found');
      console.log('  🛠️  Fix these issues before deploying to production');
      console.log('  🔍 Check logs above for specific error details');
    }

    // Exit with appropriate code
    process.exit(result.isSuccess ? 0 : 1);

  } catch (error) {
    console.error('💥 Fatal error during integration test:', error);
    console.log('\n🛠️  This indicates a serious problem with the container setup.');
    console.log('🔍 Please check the container configuration and try again.');
    process.exit(1);
  }
}

// Handle process termination gracefully
process.on('SIGINT', () => {
  console.log('\n⏹️  Integration test interrupted by user');
  process.exit(1);
});

process.on('SIGTERM', () => {
  console.log('\n⏹️  Integration test terminated');
  process.exit(1);
});

main().catch(error => {
  console.error('💥 Unhandled error:', error);
  process.exit(1);
});
