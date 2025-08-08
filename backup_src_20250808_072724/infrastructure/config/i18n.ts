import i18next from "i18next"
import path from "path"
import fs from "fs"
import logger from "./logger"
import config from "./environment"
import type { Request, Response, NextFunction } from "express"

// Supported languages
export const SUPPORTED_LANGUAGES = config.supportedLanguages
export const DEFAULT_LANGUAGE = config.defaultLanguage

// Ensure locales directory exists
const localesDir = path.join(__dirname, "../locales")
if (!fs.existsSync(localesDir)) {
  fs.mkdirSync(localesDir, { recursive: true })

  // Create default locale files if they don't exist
  SUPPORTED_LANGUAGES.forEach((lang) => {
    const langDir = path.join(localesDir, lang)
    if (!fs.existsSync(langDir)) {
      fs.mkdirSync(langDir, { recursive: true })
    }

    // Create translation.json if it doesn't exist
    const translationFile = path.join(langDir, "translation.json")
    if (!fs.existsSync(translationFile)) {
      const defaultTranslations = getDefaultTranslations(lang)
      fs.writeFileSync(translationFile, JSON.stringify(defaultTranslations, null, 2))
    }
  })
}

/**
 * Get default translations for a language
 */
function getDefaultTranslations(lang: string): Record<string, string> {
  const translations: Record<string, Record<string, string>> = {
    en: {
      // Common messages
      "common.success": "Success",
      "common.error": "Error",
      "common.notFound": "Not found",
      "common.unauthorized": "Unauthorized",
      "common.forbidden": "Forbidden",
      "common.validationError": "Validation error",
      "common.internalError": "Internal server error",
      "common.tooManyRequests": "Too many requests",
      
      // Authentication messages
      "auth.loginSuccess": "Login successful",
      "auth.loginFailed": "Login failed",
      "auth.logoutSuccess": "Logout successful",
      "auth.tokenExpired": "Token expired",
      "auth.invalidToken": "Invalid token",
      "auth.accessDenied": "Access denied",
      "auth.passwordChanged": "Password changed successfully",
      
      // Validation messages
      "validation.required": "{{field}} is required",
      "validation.email": "Please provide a valid email",
      "validation.minLength": "{{field}} must be at least {{min}} characters",
      "validation.maxLength": "{{field}} must not exceed {{max}} characters",
      "validation.invalidFormat": "{{field}} has invalid format",
      
      // Task messages
      "task.created": "Task created successfully",
      "task.updated": "Task updated successfully",
      "task.deleted": "Task deleted successfully",
      "task.notFound": "Task not found",
      "task.statusChanged": "Task status changed to {{status}}",
      
      // Project messages
      "project.created": "Project created successfully",
      "project.updated": "Project updated successfully",
      "project.deleted": "Project deleted successfully",
      "project.notFound": "Project not found",
      
      // User messages
      "user.created": "User created successfully",
      "user.updated": "User updated successfully",
      "user.deleted": "User deleted successfully",
      "user.notFound": "User not found",
      "user.emailExists": "Email already exists",
      "user.usernameExists": "Username already exists",
      
      // File upload messages
      "upload.success": "File uploaded successfully",
      "upload.failed": "File upload failed",
      "upload.invalidType": "Invalid file type",
      "upload.tooLarge": "File too large",
      "upload.tooMany": "Too many files",
      
      // Rate limiting messages
      "rateLimit.exceeded": "Rate limit exceeded. Please try again later.",
      "rateLimit.authExceeded": "Too many authentication attempts. Please try again later.",
      
      // Audit messages
      "audit.logged": "Activity logged successfully",
      "audit.failed": "Failed to log activity",
    },
    es: {
      // Common messages
      "common.success": "Éxito",
      "common.error": "Error",
      "common.notFound": "No encontrado",
      "common.unauthorized": "No autorizado",
      "common.forbidden": "Prohibido",
      "common.validationError": "Error de validación",
      "common.internalError": "Error interno del servidor",
      "common.tooManyRequests": "Demasiadas solicitudes",
      
      // Authentication messages
      "auth.loginSuccess": "Inicio de sesión exitoso",
      "auth.loginFailed": "Error en el inicio de sesión",
      "auth.logoutSuccess": "Cierre de sesión exitoso",
      "auth.tokenExpired": "Token expirado",
      "auth.invalidToken": "Token inválido",
      "auth.accessDenied": "Acceso denegado",
      "auth.passwordChanged": "Contraseña cambiada exitosamente",
      
      // Validation messages
      "validation.required": "{{field}} es requerido",
      "validation.email": "Por favor proporcione un email válido",
      "validation.minLength": "{{field}} debe tener al menos {{min}} caracteres",
      "validation.maxLength": "{{field}} no debe exceder {{max}} caracteres",
      "validation.invalidFormat": "{{field}} tiene formato inválido",
      
      // Task messages
      "task.created": "Tarea creada exitosamente",
      "task.updated": "Tarea actualizada exitosamente",
      "task.deleted": "Tarea eliminada exitosamente",
      "task.notFound": "Tarea no encontrada",
      "task.statusChanged": "Estado de tarea cambiado a {{status}}",
      
      // Project messages
      "project.created": "Proyecto creado exitosamente",
      "project.updated": "Proyecto actualizado exitosamente",
      "project.deleted": "Proyecto eliminado exitosamente",
      "project.notFound": "Proyecto no encontrado",
      
      // User messages
      "user.created": "Usuario creado exitosamente",
      "user.updated": "Usuario actualizado exitosamente",
      "user.deleted": "Usuario eliminado exitosamente",
      "user.notFound": "Usuario no encontrado",
      "user.emailExists": "El email ya existe",
      "user.usernameExists": "El nombre de usuario ya existe",
      
      // File upload messages
      "upload.success": "Archivo subido exitosamente",
      "upload.failed": "Error al subir archivo",
      "upload.invalidType": "Tipo de archivo inválido",
      "upload.tooLarge": "Archivo demasiado grande",
      "upload.tooMany": "Demasiados archivos",
      
      // Rate limiting messages
      "rateLimit.exceeded": "Límite de velocidad excedido. Inténtelo de nuevo más tarde.",
      "rateLimit.authExceeded": "Demasiados intentos de autenticación. Inténtelo de nuevo más tarde.",
      
      // Audit messages
      "audit.logged": "Actividad registrada exitosamente",
      "audit.failed": "Error al registrar actividad",
    },
    fr: {
      // Common messages
      "common.success": "Succès",
      "common.error": "Erreur",
      "common.notFound": "Non trouvé",
      "common.unauthorized": "Non autorisé",
      "common.forbidden": "Interdit",
      "common.validationError": "Erreur de validation",
      "common.internalError": "Erreur interne du serveur",
      "common.tooManyRequests": "Trop de requêtes",
      
      // Authentication messages
      "auth.loginSuccess": "Connexion réussie",
      "auth.loginFailed": "Échec de la connexion",
      "auth.logoutSuccess": "Déconnexion réussie",
      "auth.tokenExpired": "Token expiré",
      "auth.invalidToken": "Token invalide",
      "auth.accessDenied": "Accès refusé",
      "auth.passwordChanged": "Mot de passe changé avec succès",
      
      // Validation messages
      "validation.required": "{{field}} est requis",
      "validation.email": "Veuillez fournir un email valide",
      "validation.minLength": "{{field}} doit contenir au moins {{min}} caractères",
      "validation.maxLength": "{{field}} ne doit pas dépasser {{max}} caractères",
      "validation.invalidFormat": "{{field}} a un format invalide",
      
      // Task messages
      "task.created": "Tâche créée avec succès",
      "task.updated": "Tâche mise à jour avec succès",
      "task.deleted": "Tâche supprimée avec succès",
      "task.notFound": "Tâche non trouvée",
      "task.statusChanged": "Statut de la tâche changé en {{status}}",
      
      // Project messages
      "project.created": "Projet créé avec succès",
      "project.updated": "Projet mis à jour avec succès",
      "project.deleted": "Projet supprimé avec succès",
      "project.notFound": "Projet non trouvé",
      
      // User messages
      "user.created": "Utilisateur créé avec succès",
      "user.updated": "Utilisateur mis à jour avec succès",
      "user.deleted": "Utilisateur supprimé avec succès",
      "user.notFound": "Utilisateur non trouvé",
      "user.emailExists": "L'email existe déjà",
      "user.usernameExists": "Le nom d'utilisateur existe déjà",
      
      // File upload messages
      "upload.success": "Fichier téléchargé avec succès",
      "upload.failed": "Échec du téléchargement du fichier",
      "upload.invalidType": "Type de fichier invalide",
      "upload.tooLarge": "Fichier trop volumineux",
      "upload.tooMany": "Trop de fichiers",
      
      // Rate limiting messages
      "rateLimit.exceeded": "Limite de débit dépassée. Veuillez réessayer plus tard.",
      "rateLimit.authExceeded": "Trop de tentatives d'authentification. Veuillez réessayer plus tard.",
      
      // Audit messages
      "audit.logged": "Activité enregistrée avec succès",
      "audit.failed": "Échec de l'enregistrement de l'activité",
    },
    de: {
      // Common messages
      "common.success": "Erfolg",
      "common.error": "Fehler",
      "common.notFound": "Nicht gefunden",
      "common.unauthorized": "Nicht autorisiert",
      "common.forbidden": "Verboten",
      "common.validationError": "Validierungsfehler",
      "common.internalError": "Interner Serverfehler",
      "common.tooManyRequests": "Zu viele Anfragen",
      
      // Authentication messages
      "auth.loginSuccess": "Anmeldung erfolgreich",
      "auth.loginFailed": "Anmeldung fehlgeschlagen",
      "auth.logoutSuccess": "Abmeldung erfolgreich",
      "auth.tokenExpired": "Token abgelaufen",
      "auth.invalidToken": "Ungültiger Token",
      "auth.accessDenied": "Zugriff verweigert",
      "auth.passwordChanged": "Passwort erfolgreich geändert",
      
      // Validation messages
      "validation.required": "{{field}} ist erforderlich",
      "validation.email": "Bitte geben Sie eine gültige E-Mail an",
      "validation.minLength": "{{field}} muss mindestens {{min}} Zeichen haben",
      "validation.maxLength": "{{field}} darf nicht mehr als {{max}} Zeichen haben",
      "validation.invalidFormat": "{{field}} hat ein ungültiges Format",
      
      // Task messages
      "task.created": "Aufgabe erfolgreich erstellt",
      "task.updated": "Aufgabe erfolgreich aktualisiert",
      "task.deleted": "Aufgabe erfolgreich gelöscht",
      "task.notFound": "Aufgabe nicht gefunden",
      "task.statusChanged": "Aufgabenstatus geändert zu {{status}}",
      
      // Project messages
      "project.created": "Projekt erfolgreich erstellt",
      "project.updated": "Projekt erfolgreich aktualisiert",
      "project.deleted": "Projekt erfolgreich gelöscht",
      "project.notFound": "Projekt nicht gefunden",
      
      // User messages
      "user.created": "Benutzer erfolgreich erstellt",
      "user.updated": "Benutzer erfolgreich aktualisiert",
      "user.deleted": "Benutzer erfolgreich gelöscht",
      "user.notFound": "Benutzer nicht gefunden",
      "user.emailExists": "E-Mail existiert bereits",
      "user.usernameExists": "Benutzername existiert bereits",
      
      // File upload messages
      "upload.success": "Datei erfolgreich hochgeladen",
      "upload.failed": "Datei-Upload fehlgeschlagen",
      "upload.invalidType": "Ungültiger Dateityp",
      "upload.tooLarge": "Datei zu groß",
      "upload.tooMany": "Zu viele Dateien",
      
      // Rate limiting messages
      "rateLimit.exceeded": "Rate-Limit überschritten. Bitte versuchen Sie es später erneut.",
      "rateLimit.authExceeded": "Zu viele Authentifizierungsversuche. Bitte versuchen Sie es später erneut.",
      
      // Audit messages
      "audit.logged": "Aktivität erfolgreich protokolliert",
      "audit.failed": "Fehler beim Protokollieren der Aktivität",
    },
    zh: {
      // Common messages
      "common.success": "成功",
      "common.error": "错误",
      "common.notFound": "未找到",
      "common.unauthorized": "未授权",
      "common.forbidden": "禁止访问",
      "common.validationError": "验证错误",
      "common.internalError": "内部服务器错误",
      "common.tooManyRequests": "请求过多",
      
      // Authentication messages
      "auth.loginSuccess": "登录成功",
      "auth.loginFailed": "登录失败",
      "auth.logoutSuccess": "退出成功",
      "auth.tokenExpired": "令牌已过期",
      "auth.invalidToken": "无效令牌",
      "auth.accessDenied": "访问被拒绝",
      "auth.passwordChanged": "密码修改成功",
      
      // Validation messages
      "validation.required": "{{field}} 是必需的",
      "validation.email": "请提供有效的电子邮件",
      "validation.minLength": "{{field}} 必须至少包含 {{min}} 个字符",
      "validation.maxLength": "{{field}} 不能超过 {{max}} 个字符",
      "validation.invalidFormat": "{{field}} 格式无效",
      
      // Task messages
      "task.created": "任务创建成功",
      "task.updated": "任务更新成功",
      "task.deleted": "任务删除成功",
      "task.notFound": "未找到任务",
      "task.statusChanged": "任务状态已更改为 {{status}}",
      
      // Project messages
      "project.created": "项目创建成功",
      "project.updated": "项目更新成功",
      "project.deleted": "项目删除成功",
      "project.notFound": "未找到项目",
      
      // User messages
      "user.created": "用户创建成功",
      "user.updated": "用户更新成功",
      "user.deleted": "用户删除成功",
      "user.notFound": "未找到用户",
      "user.emailExists": "电子邮件已存在",
      "user.usernameExists": "用户名已存在",
      
      // File upload messages
      "upload.success": "文件上传成功",
      "upload.failed": "文件上传失败",
      "upload.invalidType": "无效的文件类型",
      "upload.tooLarge": "文件过大",
      "upload.tooMany": "文件过多",
      
      // Rate limiting messages
      "rateLimit.exceeded": "超出速率限制。请稍后再试。",
      "rateLimit.authExceeded": "认证尝试次数过多。请稍后再试。",
      
      // Audit messages
      "audit.logged": "活动记录成功",
      "audit.failed": "活动记录失败",
    }
  }

  return translations[lang] || translations.en
}

/**
 * Initialize i18next
 */
export const initI18n = async (): Promise<void> => {
  try {
    await i18next.init({
      lng: DEFAULT_LANGUAGE,
      fallbackLng: DEFAULT_LANGUAGE,
      supportedLngs: SUPPORTED_LANGUAGES,
      resources: {},
      interpolation: {
        escapeValue: false,
      },
      detection: {
        order: ["querystring", "cookie", "header"],
        lookupQuerystring: "lang",
        lookupCookie: "i18next",
        lookupHeader: "accept-language",
        caches: ["cookie"],
      },
      ns: ["translation"],
      defaultNS: "translation",
    })

    // Load translations from files
    for (const lang of SUPPORTED_LANGUAGES) {
      const translationFile = path.join(localesDir, lang, "translation.json")
      if (fs.existsSync(translationFile)) {
        try {
          const translations = JSON.parse(fs.readFileSync(translationFile, "utf8"))
          i18next.addResourceBundle(lang, "translation", translations, true, true)
        } catch (error) {
          logger.warn(`Failed to load translations for ${lang}:`, error)
        }
      }
    }

    logger.info(`i18n initialized with languages: ${SUPPORTED_LANGUAGES.join(", ")}`)
  } catch (error) {
    logger.error("Failed to initialize i18n:", error)
    throw error
  }
}

/**
 * Middleware to detect and set language for each request
 */
export const i18nMiddleware = (req: Request, res: Response, next: NextFunction): void => {
  // Detect language from query, cookie, or header
  let language = DEFAULT_LANGUAGE

  // Check query parameter
  if (req.query.lang && typeof req.query.lang === "string" && SUPPORTED_LANGUAGES.includes(req.query.lang)) {
    language = req.query.lang
  }
  // Check cookie
  else if (req.cookies?.i18next && SUPPORTED_LANGUAGES.includes(req.cookies.i18next)) {
    language = req.cookies.i18next
  }
  // Check Accept-Language header
  else if (req.headers["accept-language"]) {
    const acceptedLanguages = req.headers["accept-language"].split(",")
    for (const acceptedLang of acceptedLanguages) {
      const lang = acceptedLang.split(";")[0].trim().toLowerCase()
      if (SUPPORTED_LANGUAGES.includes(lang)) {
        language = lang
        break
      }
      // Check for language without region (e.g., 'en' from 'en-US')
      const langWithoutRegion = lang.split("-")[0]
      if (SUPPORTED_LANGUAGES.includes(langWithoutRegion)) {
        language = langWithoutRegion
        break
      }
    }
  }

  // Set language for this request
  i18next.changeLanguage(language)

  // Set cookie if language was detected from query or header
  if (req.query.lang || req.headers["accept-language"]) {
    res.cookie("i18next", language, {
      maxAge: 365 * 24 * 60 * 60 * 1000, // 1 year
      httpOnly: true,
      secure: config.nodeEnv === "production",
      sameSite: "lax",
    })
  }

  // Add translation function to request
  ;(req as any).t = (key: string, options?: any) => i18next.t(key, options)
  ;(req as any).language = language

  next()
}

/**
 * Get translation function
 */
export const t = (key: string, options?: any): string => {
  return i18next.t(key, options) as string
}

/**
 * Change language
 */
export const changeLanguage = async (language: string): Promise<void> => {
  if (SUPPORTED_LANGUAGES.includes(language)) {
    await i18next.changeLanguage(language)
  }
}

export default i18next
