#!/usr/bin/env tsx
import { DIContainer } from '../src/shared/container/container';
import { SERVICE_TOKENS } from '../src/shared/container/types';
import { registerServices } from '../src/shared/container/service-registration';

async function debugNotificationService() {
  console.log('🔍 Debugging NotificationApplicationService Dependencies...');
  
  const container = new DIContainer();
  
  try {
    // Register all services
    console.log('📦 Registering all services...');
    registerServices(container);
    console.log('✅ All services registered successfully');
    
    // Try to resolve each dependency of NotificationApplicationService one by one
    const dependencies = [
      'TASK_REPOSITORY',
      'USER_REPOSITORY', 
      'PROJECT_REPOSITORY',
      'WORKSPACE_REPOSITORY',
      'EMAIL_SERVICE',
      'CACHE_SERVICE',
      'DOMAIN_EVENT_PUBLISHER',
      'LOGGING_SERVICE'
    ];
    
    console.log('\n🧪 Testing individual dependencies...');
    
    for (const dep of dependencies) {
      try {
        const token = SERVICE_TOKENS[dep as keyof typeof SERVICE_TOKENS];
        console.log(`  Testing ${dep}...`);
        const resolved = container.resolve(token);
        console.log(`  ✅ ${dep}: ${resolved?.constructor?.name || 'resolved'}`);
      } catch (error) {
        console.log(`  ❌ ${dep}: ${(error as Error).message}`);
        console.log(`     Error details:`, error);
        return;
      }
    }
    
    console.log('\n🎯 Testing NotificationApplicationService...');
    const notificationService = container.resolve(SERVICE_TOKENS.NOTIFICATION_APPLICATION_SERVICE);
    console.log('✅ NotificationApplicationService resolved successfully!');
    console.log('   Type:', notificationService?.constructor?.name);
    
  } catch (error) {
    console.error('❌ Error:', (error as Error).message);
    console.error('   Stack:', (error as Error).stack);
  }
}

debugNotificationService().catch(console.error);
