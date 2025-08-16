# @taskmanagement/i18n

Comprehensive internationalization (i18n) package for the task management application. Provides translation management, locale detection, formatting utilities, and middleware for multi-language support.

## Features

- 🌍 **Multi-language Support**: Support for English, Spanish, French, German, and Chinese
- 🔄 **Dynamic Translation Loading**: Load translations from files, objects, or remote sources
- 📅 **Date & Time Formatting**: Locale-aware date, time, and relative time formatting
- 💰 **Number & Currency Formatting**: Format numbers, percentages, and currencies by locale
- 🎯 **Locale Detection**: Automatic locale detection from browser, headers, or device settings
- ⚡ **Middleware Integration**: Ready-to-use middleware for Express, Fastify, and Next.js
- 🔧 **TypeScript Support**: Full TypeScript support with type-safe translations
- 🧪 **Comprehensive Testing**: Extensive test coverage for all functionality

## Installation

```bash
npm install @taskmanagement/i18n
```

## Quick Start

### Basic Usage

```typescript
import { initializeI18n, t, setLocale } from '@taskmanagement/i18n';

// Initialize the i18n system
await initializeI18n({
  defaultLocale: 'en',
  fallbackLocale: 'en',
  translationsPath: './locales',
});

// Use translations
console.log(t('common.success')); // "Success"
console.log(t('greeting', { name: 'John' })); // "Hello, John!"

// Change locale
setLocale('es');
console.log(t('common.success')); // "Éxito"
```

### With Custom Translations

```typescript
import { i18nManager } from '@taskmanagement/i18n';

// Add translations programmatically
i18nManager.addTranslations('en', 'app', {
  welcome: 'Welcome to our app!',
  user: {
    profile: 'User Profile',
    settings: 'Settings',
  },
});

// Use the translations
console.log(t('app:welcome')); // "Welcome to our app!"
console.log(t('app:user.profile')); // "User Profile"
```

## API Reference

### Core Functions

#### `initializeI18n(config?)`

Initialize the i18n system with optional configuration.

```typescript
await initializeI18n({
  defaultLocale: 'en',
  fallbackLocale: 'en',
  translationsPath: './locales',
  autoLoad: true,
});
```

#### `t(key, options?, locale?)`

Translate a key with optional interpolation and locale override.

```typescript
t('common.success') // "Success"
t('greeting', { name: 'John' }) // "Hello, John!"
t('common.success', {}, 'es') // "Éxito"
```

#### `setLocale(locale)` / `getCurrentLocale()`

Set or get the current locale.

```typescript
setLocale('es');
console.log(getCurrentLocale()); // "es"
```

### Formatting Functions

#### `formatDate(date, locale?, options?)`

Format dates according to locale.

```typescript
const date = new Date('2023-12-25');
formatDate(date, 'en'); // "12/25/2023"
formatDate(date, 'de'); // "25.12.2023"
formatDate(date, 'en', { 
  year: 'numeric', 
  month: 'long', 
  day: 'numeric' 
}); // "December 25, 2023"
```

#### `formatNumber(number, locale?, options?)`

Format numbers according to locale.

```typescript
formatNumber(1234.56, 'en'); // "1,234.56"
formatNumber(1234.56, 'de'); // "1.234,56"
```

#### `formatCurrency(amount, currency, locale?)`

Format currency amounts.

```typescript
formatCurrency(1234.56, 'USD', 'en'); // "$1,234.56"
formatCurrency(1234.56, 'EUR', 'de'); // "1.234,56 €"
```

### Advanced Usage

#### Custom Translation Loader

```typescript
import { translationLoader } from '@taskmanagement/i18n';

// Load from object
await translationLoader.loadFromObject('en', 'custom', {
  message: 'Custom message',
});

// Load from file
await translationLoader.loadFromFile('./custom-translations.json', 'en', 'custom');

// Load from directory
await translationLoader.loadFromDirectory('./locales');
```

#### Middleware Integration

##### Express/Fastify

```typescript
import { createLocaleMiddleware } from '@taskmanagement/i18n';

const localeMiddleware = createLocaleMiddleware({
  defaultLocale: 'en',
  supportedLocales: ['en', 'es', 'fr', 'de', 'zh'],
  cookieName: 'locale',
});

app.use(localeMiddleware);
```

##### Next.js

```typescript
import { detectLocaleFromNextRequest } from '@taskmanagement/i18n';

export function middleware(request: NextRequest) {
  const locale = detectLocaleFromNextRequest(request);
  // Use locale for routing or set in headers
}
```

#### Language Detection

```typescript
import { 
  detectLocaleFromDevice, 
  detectLocaleFromNextRequest,
  LanguageDetector 
} from '@taskmanagement/i18n';

// Browser detection
const browserLocale = detectLocaleFromDevice();

// Request header detection
const requestLocale = detectLocaleFromNextRequest(request);

// Advanced detection
const detector = new LanguageDetector({
  sources: ['cookie', 'header', 'query', 'path'],
  fallback: 'en',
});
const detectedLocale = detector.detect(request);
```

## Translation File Structure

### Directory Structure

```
locales/
├── en/
│   ├── common.json
│   ├── translation.json
│   └── errors.json
├── es/
│   ├── common.json
│   ├── translation.json
│   └── errors.json
└── fr/
    ├── common.json
    ├── translation.json
    └── errors.json
```

### Translation File Format

```json
{
  "common": {
    "success": "Success",
    "error": "Error",
    "loading": "Loading...",
    "save": "Save",
    "cancel": "Cancel"
  },
  "user": {
    "profile": "User Profile",
    "settings": "Settings",
    "logout": "Logout"
  },
  "messages": {
    "welcome": "Welcome, {{name}}!",
    "itemCount": "You have {{count}} item",
    "itemCount_plural": "You have {{count}} items"
  }
}
```

## Supported Locales

- **English (en)**: Default locale with full translation coverage
- **Spanish (es)**: Complete translations for all features
- **French (fr)**: Complete translations for all features  
- **German (de)**: Complete translations for all features
- **Chinese (zh)**: Complete translations for all features

## Configuration Options

### I18n Manager Options

```typescript
interface I18nConfig {
  defaultLocale: string;
  fallbackLocale: string;
  namespaces: string[];
  translationsPath?: string;
  interpolation?: {
    prefix: string;
    suffix: string;
    escapeValue: boolean;
  };
}
```

### Middleware Options

```typescript
interface LocaleMiddlewareOptions {
  defaultLocale: string;
  supportedLocales: string[];
  cookieName: string;
  headerName: string;
  queryParam: string;
  pathParam: string;
  detectOrder: ('cookie' | 'header' | 'query' | 'path')[];
}
```

## Testing

The package includes comprehensive tests for all functionality:

```bash
# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Run tests in watch mode
npm run test:watch
```

## TypeScript Support

Full TypeScript support with type-safe translations:

```typescript
// Type-safe translation keys
type TranslationKey = 'common.success' | 'common.error' | 'user.profile';

// Type-safe translation function
function typedT(key: TranslationKey, options?: any): string {
  return t(key, options);
}
```

## Performance Considerations

- **Lazy Loading**: Translations are loaded on-demand
- **Caching**: Formatted results are cached for performance
- **Tree Shaking**: Only used formatters and detectors are included
- **Memory Management**: Automatic cleanup of unused translations

## Browser Support

- Modern browsers with Intl API support
- Node.js 18+ with full Intl support
- React Native with polyfills

## Contributing

1. Add new translations to the appropriate locale files
2. Update type definitions for new translation keys
3. Add tests for new functionality
4. Update documentation

## License

MIT License - see LICENSE file for details.