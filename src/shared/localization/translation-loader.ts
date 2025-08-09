import { i18nManager, TranslationResource } from './i18n-manager';

export interface TranslationFile {
  locale: string;
  namespace: string;
  path: string;
  content: TranslationResource;
  lastModified: Date;
}

export interface LoaderOptions {
  watch?: boolean;
  lazy?: boolean;
  fallback?: boolean;
  cache?: boolean;
  validate?: boolean;
}

export class TranslationLoader {
  private loadedFiles: Map<string, TranslationFile> = new Map();
  private watchers: Map<string, any> = new Map();
  private cache: Map<string, TranslationResource> = new Map();

  constructor(private options: LoaderOptions = {}) {
    this.options = {
      watch: false,
      lazy: true,
      fallback: true,
      cache: true,
      validate: true,
      ...options,
    };
  }

  /**
   * Load translations from directory structure
   */
  async loadFromDirectory(basePath: string): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      const localeDirectories = await fs.readdir(basePath);

      for (const localeDir of localeDirectories) {
        const localePath = path.join(basePath, localeDir);
        const stat = await fs.stat(localePath);

        if (stat.isDirectory()) {
          await this.loadLocaleDirectory(localeDir, localePath);
        }
      }

      if (this.options.watch) {
        this.setupFileWatching(basePath);
      }
    } catch (error) {
      console.error(`Failed to load translations from ${basePath}:`, error);
      throw error;
    }
  }

  /**
   * Load translations from a single file
   */
  async loadFromFile(
    locale: string,
    namespace: string,
    filePath: string
  ): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      const content = await fs.readFile(filePath, 'utf8');
      const translations = JSON.parse(content);

      if (this.options.validate) {
        this.validateTranslationStructure(translations);
      }

      const stat = await fs.stat(filePath);
      const translationFile: TranslationFile = {
        locale,
        namespace,
        path: filePath,
        content: translations,
        lastModified: stat.mtime,
      };

      const key = `${locale}:${namespace}`;
      this.loadedFiles.set(key, translationFile);

      if (this.options.cache) {
        this.cache.set(key, translations);
      }

      i18nManager.loadTranslations(locale, namespace, translations);

      if (this.options.watch) {
        this.watchFile(filePath, locale, namespace);
      }
    } catch (error) {
      console.error(`Failed to load translation file ${filePath}:`, error);
      throw error;
    }
  }

  /**
   * Load translations from URL (for remote translations)
   */
  async loadFromUrl(
    locale: string,
    namespace: string,
    url: string
  ): Promise<void> {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const translations = await response.json();

      if (this.options.validate) {
        this.validateTranslationStructure(translations);
      }

      const translationFile: TranslationFile = {
        locale,
        namespace,
        path: url,
        content: translations,
        lastModified: new Date(),
      };

      const key = `${locale}:${namespace}`;
      this.loadedFiles.set(key, translationFile);

      if (this.options.cache) {
        this.cache.set(key, translations);
      }

      i18nManager.loadTranslations(locale, namespace, translations);
    } catch (error) {
      console.error(`Failed to load translations from URL ${url}:`, error);
      throw error;
    }
  }

  /**
   * Load translations lazily when needed
   */
  async loadLazy(locale: string, namespace: string): Promise<boolean> {
    const key = `${locale}:${namespace}`;

    if (this.loadedFiles.has(key)) {
      return true;
    }

    if (this.options.cache && this.cache.has(key)) {
      const translations = this.cache.get(key)!;
      i18nManager.loadTranslations(locale, namespace, translations);
      return true;
    }

    // Try to load from conventional path
    const conventionalPath = `./locales/${locale}/${namespace}.json`;
    try {
      await this.loadFromFile(locale, namespace, conventionalPath);
      return true;
    } catch (error) {
      console.warn(`Could not lazy load ${key} from ${conventionalPath}`);
      return false;
    }
  }

  /**
   * Reload translations from source
   */
  async reload(locale?: string, namespace?: string): Promise<void> {
    if (locale && namespace) {
      const key = `${locale}:${namespace}`;
      const file = this.loadedFiles.get(key);

      if (file) {
        if (file.path.startsWith('http')) {
          await this.loadFromUrl(locale, namespace, file.path);
        } else {
          await this.loadFromFile(locale, namespace, file.path);
        }
      }
    } else {
      // Reload all translations
      const reloadPromises = Array.from(this.loadedFiles.values()).map(file => {
        if (file.path.startsWith('http')) {
          return this.loadFromUrl(file.locale, file.namespace, file.path);
        } else {
          return this.loadFromFile(file.locale, file.namespace, file.path);
        }
      });

      await Promise.all(reloadPromises);
    }
  }

  /**
   * Get loaded translation files info
   */
  getLoadedFiles(): TranslationFile[] {
    return Array.from(this.loadedFiles.values());
  }

  /**
   * Check if translations are loaded for locale/namespace
   */
  isLoaded(locale: string, namespace: string): boolean {
    const key = `${locale}:${namespace}`;
    return (
      this.loadedFiles.has(key) || (this.options.cache && this.cache.has(key))
    );
  }

  /**
   * Clear cache
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Stop file watching
   */
  stopWatching(): void {
    for (const watcher of this.watchers.values()) {
      if (watcher && typeof watcher.close === 'function') {
        watcher.close();
      }
    }
    this.watchers.clear();
  }

  /**
   * Export loaded translations
   */
  exportTranslations(format: 'json' | 'csv' | 'xlsx' = 'json'): any {
    const exported: Record<string, Record<string, TranslationResource>> = {};

    for (const [key, file] of this.loadedFiles) {
      if (!exported[file.locale]) {
        exported[file.locale] = {};
      }
      exported[file.locale][file.namespace] = file.content;
    }

    switch (format) {
      case 'json':
        return exported;
      case 'csv':
        return this.exportToCSV(exported);
      case 'xlsx':
        return this.exportToXLSX(exported);
      default:
        return exported;
    }
  }

  /**
   * Import translations from various formats
   */
  async importTranslations(
    data: any,
    format: 'json' | 'csv' | 'xlsx' = 'json',
    options: { merge?: boolean; validate?: boolean } = {}
  ): Promise<void> {
    const { merge = true, validate = true } = options;

    let translations: Record<string, Record<string, TranslationResource>>;

    switch (format) {
      case 'json':
        translations = data;
        break;
      case 'csv':
        translations = this.importFromCSV(data);
        break;
      case 'xlsx':
        translations = this.importFromXLSX(data);
        break;
      default:
        throw new Error(`Unsupported import format: ${format}`);
    }

    for (const [locale, namespaces] of Object.entries(translations)) {
      for (const [namespace, content] of Object.entries(namespaces)) {
        if (validate) {
          this.validateTranslationStructure(content);
        }

        await i18nManager.importTranslations(locale, content, {
          namespace,
          merge,
          validate,
        });

        // Update loaded files registry
        const key = `${locale}:${namespace}`;
        const existingFile = this.loadedFiles.get(key);

        this.loadedFiles.set(key, {
          locale,
          namespace,
          path: existingFile?.path || 'imported',
          content,
          lastModified: new Date(),
        });
      }
    }
  }

  /**
   * Load translations for a specific locale directory
   */
  private async loadLocaleDirectory(
    locale: string,
    localePath: string
  ): Promise<void> {
    const fs = require('fs').promises;
    const path = require('path');

    try {
      const files = await fs.readdir(localePath);

      for (const file of files) {
        if (file.endsWith('.json')) {
          const filePath = path.join(localePath, file);
          const namespace = path.basename(file, '.json');

          await this.loadFromFile(locale, namespace, filePath);
        }
      }
    } catch (error) {
      console.error(`Failed to load locale directory ${localePath}:`, error);
    }
  }

  /**
   * Setup file system watching for automatic reloading
   */
  private setupFileWatching(basePath: string): void {
    const fs = require('fs');
    const path = require('path');

    try {
      const watcher = fs.watch(
        basePath,
        { recursive: true },
        (eventType: string, filename: string) => {
          if (filename && filename.endsWith('.json')) {
            const fullPath = path.join(basePath, filename);
            const pathParts = filename.split(path.sep);

            if (pathParts.length >= 2) {
              const locale = pathParts[0];
              const namespace = path.basename(pathParts[1], '.json');

              console.log(`Translation file changed: ${filename}`);
              this.loadFromFile(locale, namespace, fullPath).catch(error => {
                console.error(`Failed to reload ${filename}:`, error);
              });
            }
          }
        }
      );

      this.watchers.set(basePath, watcher);
    } catch (error) {
      console.warn(`Failed to setup file watching for ${basePath}:`, error);
    }
  }

  /**
   * Watch a specific file for changes
   */
  private watchFile(filePath: string, locale: string, namespace: string): void {
    const fs = require('fs');

    try {
      const watcher = fs.watchFile(filePath, (curr: any, prev: any) => {
        if (curr.mtime > prev.mtime) {
          console.log(`Translation file changed: ${filePath}`);
          this.loadFromFile(locale, namespace, filePath).catch(error => {
            console.error(`Failed to reload ${filePath}:`, error);
          });
        }
      });

      this.watchers.set(filePath, watcher);
    } catch (error) {
      console.warn(`Failed to watch file ${filePath}:`, error);
    }
  }

  /**
   * Validate translation structure
   */
  private validateTranslationStructure(translations: any): void {
    if (typeof translations !== 'object' || translations === null) {
      throw new Error('Translations must be an object');
    }

    // Check for circular references
    try {
      JSON.stringify(translations);
    } catch (error) {
      throw new Error('Translations contain circular references');
    }

    // Validate structure recursively
    this.validateTranslationObject(translations, '');
  }

  /**
   * Validate translation object recursively
   */
  private validateTranslationObject(obj: any, path: string): void {
    for (const [key, value] of Object.entries(obj)) {
      const currentPath = path ? `${path}.${key}` : key;

      if (typeof value === 'string') {
        // Valid string translation
        continue;
      } else if (typeof value === 'object' && value !== null) {
        // Nested object, validate recursively
        this.validateTranslationObject(value, currentPath);
      } else {
        throw new Error(
          `Invalid translation value at ${currentPath}: must be string or object`
        );
      }
    }
  }

  /**
   * Export translations to CSV format
   */
  private exportToCSV(
    translations: Record<string, Record<string, TranslationResource>>
  ): string {
    const rows: string[] = ['Key,Namespace,Locale,Value'];

    for (const [locale, namespaces] of Object.entries(translations)) {
      for (const [namespace, content] of Object.entries(namespaces)) {
        this.flattenTranslationsForCSV(content, '', namespace, locale, rows);
      }
    }

    return rows.join('\n');
  }

  /**
   * Flatten translations for CSV export
   */
  private flattenTranslationsForCSV(
    obj: TranslationResource,
    prefix: string,
    namespace: string,
    locale: string,
    rows: string[]
  ): void {
    for (const [key, value] of Object.entries(obj)) {
      const fullKey = prefix ? `${prefix}.${key}` : key;

      if (typeof value === 'string') {
        const escapedValue = value.replace(/"/g, '""');
        rows.push(`"${fullKey}","${namespace}","${locale}","${escapedValue}"`);
      } else if (typeof value === 'object') {
        this.flattenTranslationsForCSV(value, fullKey, namespace, locale, rows);
      }
    }
  }

  /**
   * Import translations from CSV format
   */
  private importFromCSV(
    csvData: string
  ): Record<string, Record<string, TranslationResource>> {
    const lines = csvData.split('\n');
    const headers = lines[0].split(',');
    const translations: Record<
      string,
      Record<string, TranslationResource>
    > = {};

    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = this.parseCSVLine(line);
      if (values.length < 4) continue;

      const [key, namespace, locale, value] = values;

      if (!translations[locale]) {
        translations[locale] = {};
      }
      if (!translations[locale][namespace]) {
        translations[locale][namespace] = {};
      }

      this.setNestedValue(translations[locale][namespace], key, value);
    }

    return translations;
  }

  /**
   * Parse CSV line handling quoted values
   */
  private parseCSVLine(line: string): string[] {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];

      if (char === '"') {
        if (inQuotes && line[i + 1] === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }

    result.push(current);
    return result;
  }

  /**
   * Set nested value in object using dot notation
   */
  private setNestedValue(
    obj: TranslationResource,
    path: string,
    value: string
  ): void {
    const keys = path.split('.');
    let current: any = obj;

    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current) || typeof current[key] !== 'object') {
        current[key] = {};
      }
      current = current[key];
    }

    current[keys[keys.length - 1]] = value;
  }

  /**
   * Export to XLSX format (placeholder - would need xlsx library)
   */
  private exportToXLSX(
    translations: Record<string, Record<string, TranslationResource>>
  ): any {
    // This would require the 'xlsx' library
    // For now, return JSON format
    console.warn('XLSX export not implemented, returning JSON format');
    return translations;
  }

  /**
   * Import from XLSX format (placeholder - would need xlsx library)
   */
  private importFromXLSX(
    xlsxData: any
  ): Record<string, Record<string, TranslationResource>> {
    // This would require the 'xlsx' library
    // For now, assume it's already in the correct format
    console.warn('XLSX import not implemented, assuming JSON format');
    return xlsxData;
  }
}

// Export singleton instance
export const translationLoader = new TranslationLoader();
