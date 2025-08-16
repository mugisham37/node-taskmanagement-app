import { initializeI18n, t, setLocale, getCurrentLocale } from './index';

/**
 * Test the i18n system
 */
async function testI18nSystem() {
  try {
    console.log('Initializing i18n system...');
    await initializeI18n({
      defaultLocale: 'en',
      fallbackLocale: 'en',
      translationsPath: './src/shared/localization/locales',
      autoLoad: true,
    });

    console.log('Current locale:', getCurrentLocale());

    // Test translations
    console.log('Testing English translations:');
    console.log('Hello:', t('common.hello'));
    console.log('Create Task:', t('tasks.create'));

    // Switch to Spanish
    setLocale('es');
    console.log('\nCurrent locale:', getCurrentLocale());

    console.log('Testing Spanish translations:');
    console.log('Hello:', t('common.hello'));
    console.log('Create Task:', t('tasks.create'));

    console.log('\nI18n system test completed successfully!');
  } catch (error) {
    console.error('I18n system test failed:', error);
  }
}

// Export for testing
export { testI18nSystem };
