import type { Request, Response, NextFunction } from "express";
import config from "../config/environment";
import logger from "../config/logger";
import { AppError } from "../utils/app-error";

// Simple translation store (in production, this would come from a database or external service)
const translations: Record<string, Record<string, string>> = {
  en: {
    "welcome": "Welcome",
    "error.validation": "Validation error",
    "error.unauthorized": "Unauthorized access",
    "error.forbidden": "Access forbidden",
    "error.notFound": "Resource not found",
    "error.internal": "Internal server error",
    "success.created": "Resource created successfully",
    "success.updated": "Resource updated successfully",
    "success.deleted": "Resource deleted successfully",
  },
  fr: {
    "welcome": "Bienvenue",
    "error.validation": "Erreur de validation",
    "error.unauthorized": "Accès non autorisé",
    "error.forbidden": "Accès interdit",
    "error.notFound": "Ressource non trouvée",
    "error.internal": "Erreur interne du serveur",
    "success.created": "Ressource créée avec succès",
    "success.updated": "Ressource mise à jour avec succès",
    "success.deleted": "Ressource supprimée avec succès",
  },
  es: {
    "welcome": "Bienvenido",
    "error.validation": "Error de validación",
    "error.unauthorized": "Acceso no autorizado",
    "error.forbidden": "Acceso prohibido",
    "error.notFound": "Recurso no encontrado",
    "error.internal": "Error interno del servidor",
    "success.created": "Recurso creado exitosamente",
    "success.updated": "Recurso actualizado exitosamente",
    "success.deleted": "Recurso eliminado exitosamente",
  },
  de: {
    "welcome": "Willkommen",
    "error.validation": "Validierungsfehler",
    "error.unauthorized": "Unbefugter Zugriff",
    "error.forbidden": "Zugriff verboten",
    "error.notFound": "Ressource nicht gefunden",
    "error.internal": "Interner Serverfehler",
    "success.created": "Ressource erfolgreich erstellt",
    "success.updated": "Ressource erfolgreich aktualisiert",
    "success.deleted": "Ressource erfolgreich gelöscht",
  },
  zh: {
    "welcome": "欢迎",
    "error.validation": "验证错误",
    "error.unauthorized": "未授权访问",
    "error.forbidden": "访问被禁止",
    "error.notFound": "资源未找到",
    "error.internal": "内部服务器错误",
    "success.created": "资源创建成功",
    "success.updated": "资源更新成功",
    "success.deleted": "资源删除成功",
  },
};

/**
 * Initialize i18n middleware
 */
export const i18nMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Initialize i18n object on request
  (req as any).i18n = {
    language: config.defaultLanguage,
    translate: (key: string, params?: Record<string, any>) => translate(key, config.defaultLanguage, params),
    setLanguage: (lang: string) => {
      if (config.supportedLanguages.includes(lang)) {
        (req as any).i18n.language = lang;
        (req as any).i18n.translate = (key: string, params?: Record<string, any>) => translate(key, lang, params);
      }
    },
  };

  next();
};

/**
 * Language detection middleware
 */
export const languageMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  let detectedLanguage = config.defaultLanguage;

  // Priority order for language detection:
  // 1. Query parameter (?lang=en)
  // 2. Header (Accept-Language)
  // 3. Custom header (X-Language)
  // 4. Default language

  // Check query parameter
  const queryLang = req.query.lang as string;
  if (queryLang && config.supportedLanguages.includes(queryLang)) {
    detectedLanguage = queryLang;
  } else {
    // Check custom header
    const headerLang = req.get("X-Language");
    if (headerLang && config.supportedLanguages.includes(headerLang)) {
      detectedLanguage = headerLang;
    } else {
      // Parse Accept-Language header
      const acceptLanguage = req.get("Accept-Language");
      if (acceptLanguage) {
        detectedLanguage = parseAcceptLanguage(acceptLanguage);
      }
    }
  }

  // Set the detected language
  if ((req as any).i18n) {
    (req as any).i18n.setLanguage(detectedLanguage);
  }

  // Add language to response headers
  res.setHeader("Content-Language", detectedLanguage);

  // Log language detection
  logger.debug("Language detected", {
    detectedLanguage,
    queryLang,
    headerLang: req.get("X-Language"),
    acceptLanguage: req.get("Accept-Language"),
    path: req.path,
  });

  next();
};

/**
 * Translation middleware - adds translation functions to response locals
 */
export const translationMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const i18n = (req as any).i18n;

  if (i18n) {
    // Add translation functions to response locals for use in templates
    res.locals.t = i18n.translate;
    res.locals.language = i18n.language;
    res.locals.supportedLanguages = config.supportedLanguages;

    // Add helper function to response object
    (res as any).translate = i18n.translate;
  }

  next();
};

/**
 * Parse Accept-Language header and return best matching supported language
 */
const parseAcceptLanguage = (acceptLanguage: string): string => {
  try {
    // Parse Accept-Language header (e.g., "en-US,en;q=0.9,fr;q=0.8")
    const languages = acceptLanguage
      .split(",")
      .map((lang) => {
        const parts = lang.trim().split(";");
        const code = parts[0].split("-")[0]; // Get language code without region
        const quality = parts[1] ? parseFloat(parts[1].split("=")[1]) : 1.0;
        return { code, quality };
      })
      .sort((a, b) => b.quality - a.quality); // Sort by quality (preference)

    // Find first supported language
    for (const lang of languages) {
      if (config.supportedLanguages.includes(lang.code)) {
        return lang.code;
      }
    }
  } catch (error) {
    logger.warn("Error parsing Accept-Language header", {
      acceptLanguage,
      error: error instanceof Error ? error.message : "Unknown error",
    });
  }

  return config.defaultLanguage;
};

/**
 * Translate a key to the specified language
 */
const translate = (key: string, language: string, params?: Record<string, any>): string => {
  try {
    // Get translation for the language
    const languageTranslations = translations[language] || translations[config.defaultLanguage];
    let translation = languageTranslations[key];

    // Fallback to default language if translation not found
    if (!translation && language !== config.defaultLanguage) {
      translation = translations[config.defaultLanguage][key];
    }

    // Fallback to key if no translation found
    if (!translation) {
      logger.warn("Translation not found", {
        key,
        language,
        fallbackLanguage: config.defaultLanguage,
      });
      translation = key;
    }

    // Replace parameters in translation
    if (params && typeof translation === "string") {
      Object.keys(params).forEach((param) => {
        translation = translation.replace(new RegExp(`{{${param}}}`, "g"), params[param]);
      });
    }

    return translation;
  } catch (error) {
    logger.error("Error in translation", {
      key,
      language,
      params,
      error: error instanceof Error ? error.message : "Unknown error",
    });
    return key; // Return key as fallback
  }
};

/**
 * Middleware to validate language parameter
 */
export const validateLanguageMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  const queryLang = req.query.lang as string;
  const headerLang = req.get("X-Language");

  // Validate query language parameter
  if (queryLang && !config.supportedLanguages.includes(queryLang)) {
    logger.warn("Invalid language in query parameter", {
      queryLang,
      supportedLanguages: config.supportedLanguages,
      path: req.path,
      ip: req.ip,
    });

    const error = new AppError(
      `Language '${queryLang}' is not supported. Supported languages: ${config.supportedLanguages.join(", ")}`,
      400,
      true,
      "INVALID_LANGUAGE"
    );

    return next(error);
  }

  // Validate header language
  if (headerLang && !config.supportedLanguages.includes(headerLang)) {
    logger.warn("Invalid language in header", {
      headerLang,
      supportedLanguages: config.supportedLanguages,
      path: req.path,
      ip: req.ip,
    });

    const error = new AppError(
      `Language '${headerLang}' is not supported. Supported languages: ${config.supportedLanguages.join(", ")}`,
      400,
      true,
      "INVALID_LANGUAGE"
    );

    return next(error);
  }

  next();
};

/**
 * Get available translations for a language
 */
export const getTranslations = (language: string): Record<string, string> => {
  return translations[language] || translations[config.defaultLanguage] || {};
};

/**
 * Add new translations
 */
export const addTranslations = (language: string, newTranslations: Record<string, string>): void => {
  if (!translations[language]) {
    translations[language] = {};
  }

  Object.assign(translations[language], newTranslations);

  logger.info("Translations added", {
    language,
    keysAdded: Object.keys(newTranslations).length,
    totalKeys: Object.keys(translations[language]).length,
  });
};

/**
 * Get translation statistics
 */
export const getTranslationStats = (): Record<string, any> => {
  const stats: Record<string, any> = {
    supportedLanguages: config.supportedLanguages,
    defaultLanguage: config.defaultLanguage,
    languages: {},
    totalKeys: 0,
  };

  config.supportedLanguages.forEach((lang) => {
    const langTranslations = translations[lang] || {};
    const keyCount = Object.keys(langTranslations).length;
    
    stats.languages[lang] = {
      keyCount,
      coverage: lang === config.defaultLanguage ? 100 : Math.round((keyCount / Object.keys(translations[config.defaultLanguage] || {}).length) * 100),
    };
  });

  stats.totalKeys = Object.keys(translations[config.defaultLanguage] || {}).length;

  return stats;
};

/**
 * Middleware to set language from user preferences (requires authentication)
 */
export const userLanguageMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // This would typically get the user's preferred language from the database
  // For now, we'll just check if user is authenticated and has language preference
  const user = (req as any).user;
  
  if (user && user.preferredLanguage && config.supportedLanguages.includes(user.preferredLanguage)) {
    if ((req as any).i18n) {
      (req as any).i18n.setLanguage(user.preferredLanguage);
    }

    logger.debug("User language preference applied", {
      userId: user.id,
      preferredLanguage: user.preferredLanguage,
    });
  }

  next();
};

/**
 * Express helper function to get translator for a specific language
 */
export const getTranslator = (language: string) => {
  return (key: string, params?: Record<string, any>) => translate(key, language, params);
};

/**
 * Utility function to check if a language is supported
 */
export const isLanguageSupported = (language: string): boolean => {
  return config.supportedLanguages.includes(language);
};
