import { logger } from './logger'
import { CacheService } from './cache'
import { z } from 'zod'
import { cookies } from 'next/headers'
import { NextRequest } from 'next/server'

// Internationalization configuration
interface I18nConfig {
  defaultLocale: string
  locales: string[]
  fallbackLocale: string
  cookieName: string
  cookieMaxAge: number
  caching: {
    enabled: boolean
    ttl: number
    keyPrefix: string
  }
  detection: {
    order: ('cookie' | 'header' | 'query' | 'path')[]
    caches: boolean
  }
  interpolation: {
    prefix: string
    suffix: string
    escapeValue: boolean
  }
  pluralization: {
    enabled: boolean
    rules: Record<string, (count: number) => string>
  }
  namespaces: string[]
  defaultNamespace: string
}

const defaultConfig: I18nConfig = {
  defaultLocale: process.env.NEXT_PUBLIC_DEFAULT_LOCALE || 'en',
  locales: (process.env.NEXT_PUBLIC_LOCALES || 'en,es,fr,de,it,pt,ru,zh,ja,ko,ar').split(','),
  fallbackLocale: process.env.NEXT_PUBLIC_FALLBACK_LOCALE || 'en',
  cookieName: process.env.NEXT_PUBLIC_LOCALE_COOKIE || 'locale',
  cookieMaxAge: parseInt(process.env.NEXT_PUBLIC_LOCALE_COOKIE_MAX_AGE || '31536000'), // 1 year
  caching: {
    enabled: process.env.I18N_CACHING_ENABLED !== 'false',
    ttl: parseInt(process.env.I18N_CACHE_TTL || '3600'), // 1 hour
    keyPrefix: process.env.I18N_CACHE_PREFIX || 'i18n:',
  },
  detection: {
    order: ['cookie', 'header', 'query', 'path'],
    caches: process.env.I18N_DETECTION_CACHES !== 'false',
  },
  interpolation: {
    prefix: '{{',
    suffix: '}}',
    escapeValue: true,
  },
  pluralization: {
    enabled: true,
    rules: {
      en: (count: number) => count === 1 ? 'one' : 'other',
      es: (count: number) => count === 1 ? 'one' : 'other',
      fr: (count: number) => count <= 1 ? 'one' : 'other',
      de: (count: number) => count === 1 ? 'one' : 'other',
      it: (count: number) => count === 1 ? 'one' : 'other',
      pt: (count: number) => count === 1 ? 'one' : 'other',
      ru: (count: number) => {
        if (count % 10 === 1 && count % 100 !== 11) return 'one'
        if (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 10 || count % 100 >= 20)) return 'few'
        return 'many'
      },
      zh: () => 'other',
      ja: () => 'other',
      ko: () => 'other',
      ar: (count: number) => {
        if (count === 0) return 'zero'
        if (count === 1) return 'one'
        if (count === 2) return 'two'
        if (count % 100 >= 3 && count % 100 <= 10) return 'few'
        if (count % 100 >= 11) return 'many'
        return 'other'
      },
    },
  },
  namespaces: ['common', 'auth', 'dashboard', 'tests', 'consultations', 'profile', 'admin', 'errors'],
  defaultNamespace: 'common',
}

// Locale information
export interface LocaleInfo {
  code: string
  name: string
  nativeName: string
  direction: 'ltr' | 'rtl'
  region: string
  currency: string
  dateFormat: string
  timeFormat: string
  numberFormat: {
    decimal: string
    thousands: string
    currency: {
      symbol: string
      position: 'before' | 'after'
    }
  }
}

// Supported locales with metadata
const localeInfo: Record<string, LocaleInfo> = {
  en: {
    code: 'en',
    name: 'English',
    nativeName: 'English',
    direction: 'ltr',
    region: 'US',
    currency: 'USD',
    dateFormat: 'MM/dd/yyyy',
    timeFormat: 'h:mm a',
    numberFormat: {
      decimal: '.',
      thousands: ',',
      currency: { symbol: '$', position: 'before' },
    },
  },
  es: {
    code: 'es',
    name: 'Spanish',
    nativeName: 'Español',
    direction: 'ltr',
    region: 'ES',
    currency: 'EUR',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    numberFormat: {
      decimal: ',',
      thousands: '.',
      currency: { symbol: '€', position: 'after' },
    },
  },
  fr: {
    code: 'fr',
    name: 'French',
    nativeName: 'Français',
    direction: 'ltr',
    region: 'FR',
    currency: 'EUR',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    numberFormat: {
      decimal: ',',
      thousands: ' ',
      currency: { symbol: '€', position: 'after' },
    },
  },
  de: {
    code: 'de',
    name: 'German',
    nativeName: 'Deutsch',
    direction: 'ltr',
    region: 'DE',
    currency: 'EUR',
    dateFormat: 'dd.MM.yyyy',
    timeFormat: 'HH:mm',
    numberFormat: {
      decimal: ',',
      thousands: '.',
      currency: { symbol: '€', position: 'after' },
    },
  },
  it: {
    code: 'it',
    name: 'Italian',
    nativeName: 'Italiano',
    direction: 'ltr',
    region: 'IT',
    currency: 'EUR',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    numberFormat: {
      decimal: ',',
      thousands: '.',
      currency: { symbol: '€', position: 'after' },
    },
  },
  pt: {
    code: 'pt',
    name: 'Portuguese',
    nativeName: 'Português',
    direction: 'ltr',
    region: 'PT',
    currency: 'EUR',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    numberFormat: {
      decimal: ',',
      thousands: ' ',
      currency: { symbol: '€', position: 'after' },
    },
  },
  ru: {
    code: 'ru',
    name: 'Russian',
    nativeName: 'Русский',
    direction: 'ltr',
    region: 'RU',
    currency: 'RUB',
    dateFormat: 'dd.MM.yyyy',
    timeFormat: 'HH:mm',
    numberFormat: {
      decimal: ',',
      thousands: ' ',
      currency: { symbol: '₽', position: 'after' },
    },
  },
  zh: {
    code: 'zh',
    name: 'Chinese',
    nativeName: '中文',
    direction: 'ltr',
    region: 'CN',
    currency: 'CNY',
    dateFormat: 'yyyy/MM/dd',
    timeFormat: 'HH:mm',
    numberFormat: {
      decimal: '.',
      thousands: ',',
      currency: { symbol: '¥', position: 'before' },
    },
  },
  ja: {
    code: 'ja',
    name: 'Japanese',
    nativeName: '日本語',
    direction: 'ltr',
    region: 'JP',
    currency: 'JPY',
    dateFormat: 'yyyy/MM/dd',
    timeFormat: 'HH:mm',
    numberFormat: {
      decimal: '.',
      thousands: ',',
      currency: { symbol: '¥', position: 'before' },
    },
  },
  ko: {
    code: 'ko',
    name: 'Korean',
    nativeName: '한국어',
    direction: 'ltr',
    region: 'KR',
    currency: 'KRW',
    dateFormat: 'yyyy. MM. dd.',
    timeFormat: 'HH:mm',
    numberFormat: {
      decimal: '.',
      thousands: ',',
      currency: { symbol: '₩', position: 'before' },
    },
  },
  ar: {
    code: 'ar',
    name: 'Arabic',
    nativeName: 'العربية',
    direction: 'rtl',
    region: 'SA',
    currency: 'SAR',
    dateFormat: 'dd/MM/yyyy',
    timeFormat: 'HH:mm',
    numberFormat: {
      decimal: '.',
      thousands: ',',
      currency: { symbol: 'ر.س', position: 'after' },
    },
  },
}

// Translation interfaces
export interface TranslationResource {
  [key: string]: string | TranslationResource
}

export interface TranslationOptions {
  count?: number
  context?: string
  defaultValue?: string
  interpolation?: Record<string, any>
  namespace?: string
}

export interface PluralOptions {
  zero?: string
  one?: string
  two?: string
  few?: string
  many?: string
  other: string
}

// Validation schemas
const i18nSchemas = {
  locale: z.string().refine(
    (locale) => defaultConfig.locales.includes(locale),
    { message: 'Invalid locale' }
  ),
  
  translationKey: z.string().min(1, 'Translation key cannot be empty'),
  
  translationOptions: z.object({
    count: z.number().optional(),
    context: z.string().optional(),
    defaultValue: z.string().optional(),
    interpolation: z.record(z.any()).optional(),
    namespace: z.string().optional(),
  }).optional(),
}

// Translation manager
export class TranslationManager {
  private static instance: TranslationManager
  private config: I18nConfig
  private translations: Map<string, TranslationResource> = new Map()
  private loadedNamespaces: Set<string> = new Set()

  private constructor(config: Partial<I18nConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
  }

  public static getInstance(config?: Partial<I18nConfig>): TranslationManager {
    if (!TranslationManager.instance) {
      TranslationManager.instance = new TranslationManager(config)
    }
    return TranslationManager.instance
  }

  // Load translations for a locale and namespace
  async loadTranslations(locale: string, namespace: string): Promise<boolean> {
    try {
      const cacheKey = `${this.config.caching.keyPrefix}${locale}:${namespace}`
      
      // Try cache first
      if (this.config.caching.enabled) {
        const cached = await CacheService.get<TranslationResource>(cacheKey)
        if (cached) {
          this.translations.set(`${locale}:${namespace}`, cached)
          this.loadedNamespaces.add(`${locale}:${namespace}`)
          return true
        }
      }

      // Load from file system or API
      const translations = await this.loadTranslationFile(locale, namespace)
      if (!translations) {
        // Try fallback locale
        if (locale !== this.config.fallbackLocale) {
          return this.loadTranslations(this.config.fallbackLocale, namespace)
        }
        return false
      }

      // Store in memory and cache
      this.translations.set(`${locale}:${namespace}`, translations)
      this.loadedNamespaces.add(`${locale}:${namespace}`)
      
      if (this.config.caching.enabled) {
        await CacheService.set(cacheKey, translations, this.config.caching.ttl)
      }

      return true
    } catch (error) {
      await logger.error('Failed to load translations', {
        locale,
        namespace,
        error: error instanceof Error ? error.message : String(error),
      })
      return false
    }
  }

  // Load translation file (implement based on your storage)
  private async loadTranslationFile(locale: string, namespace: string): Promise<TranslationResource | null> {
    try {
      // In a real implementation, you would load from:
      // - File system (public/locales/[locale]/[namespace].json)
      // - Database
      // - External translation service
      // - CDN
      
      // For now, return sample translations
      const sampleTranslations = this.getSampleTranslations(locale, namespace)
      return sampleTranslations
    } catch (error) {
      await logger.error('Failed to load translation file', {
        locale,
        namespace,
        error: error instanceof Error ? error.message : String(error),
      })
      return null
    }
  }

  // Get sample translations (replace with actual implementation)
  private getSampleTranslations(locale: string, namespace: string): TranslationResource {
    const translations: Record<string, Record<string, TranslationResource>> = {
      en: {
        common: {
          welcome: 'Welcome',
          loading: 'Loading...',
          error: 'An error occurred',
          success: 'Success',
          cancel: 'Cancel',
          save: 'Save',
          delete: 'Delete',
          edit: 'Edit',
          create: 'Create',
          update: 'Update',
          search: 'Search',
          filter: 'Filter',
          sort: 'Sort',
          pagination: {
            previous: 'Previous',
            next: 'Next',
            page: 'Page {{page}} of {{total}}',
            showing: 'Showing {{from}} to {{to}} of {{total}} results',
          },
        },
        auth: {
          login: 'Login',
          logout: 'Logout',
          register: 'Register',
          email: 'Email',
          password: 'Password',
          confirmPassword: 'Confirm Password',
          forgotPassword: 'Forgot Password?',
          resetPassword: 'Reset Password',
          rememberMe: 'Remember me',
          loginSuccess: 'Login successful',
          loginError: 'Invalid credentials',
          registerSuccess: 'Registration successful',
          registerError: 'Registration failed',
        },
        tests: {
          title: 'Tests',
          takeTest: 'Take Test',
          testResults: 'Test Results',
          score: 'Score: {{score}}%',
          timeRemaining: 'Time remaining: {{time}}',
          question: 'Question {{current}} of {{total}}',
          submit: 'Submit Test',
          review: 'Review Answers',
          passed: 'Congratulations! You passed the test.',
          failed: 'Unfortunately, you did not pass the test.',
        },
      },
      es: {
        common: {
          welcome: 'Bienvenido',
          loading: 'Cargando...',
          error: 'Ocurrió un error',
          success: 'Éxito',
          cancel: 'Cancelar',
          save: 'Guardar',
          delete: 'Eliminar',
          edit: 'Editar',
          create: 'Crear',
          update: 'Actualizar',
          search: 'Buscar',
          filter: 'Filtrar',
          sort: 'Ordenar',
          pagination: {
            previous: 'Anterior',
            next: 'Siguiente',
            page: 'Página {{page}} de {{total}}',
            showing: 'Mostrando {{from}} a {{to}} de {{total}} resultados',
          },
        },
        auth: {
          login: 'Iniciar Sesión',
          logout: 'Cerrar Sesión',
          register: 'Registrarse',
          email: 'Correo Electrónico',
          password: 'Contraseña',
          confirmPassword: 'Confirmar Contraseña',
          forgotPassword: '¿Olvidaste tu contraseña?',
          resetPassword: 'Restablecer Contraseña',
          rememberMe: 'Recordarme',
          loginSuccess: 'Inicio de sesión exitoso',
          loginError: 'Credenciales inválidas',
          registerSuccess: 'Registro exitoso',
          registerError: 'Error en el registro',
        },
        tests: {
          title: 'Pruebas',
          takeTest: 'Realizar Prueba',
          testResults: 'Resultados de la Prueba',
          score: 'Puntuación: {{score}}%',
          timeRemaining: 'Tiempo restante: {{time}}',
          question: 'Pregunta {{current}} de {{total}}',
          submit: 'Enviar Prueba',
          review: 'Revisar Respuestas',
          passed: '¡Felicitaciones! Aprobaste la prueba.',
          failed: 'Lamentablemente, no aprobaste la prueba.',
        },
      },
      // Add more locales as needed
    }

    return translations[locale]?.[namespace] || {}
  }

  // Get translation
  async getTranslation(
    locale: string,
    key: string,
    options: TranslationOptions = {}
  ): Promise<string> {
    try {
      const namespace = options.namespace || this.config.defaultNamespace
      const namespaceKey = `${locale}:${namespace}`
      
      // Ensure translations are loaded
      if (!this.loadedNamespaces.has(namespaceKey)) {
        await this.loadTranslations(locale, namespace)
      }

      const translations = this.translations.get(namespaceKey)
      if (!translations) {
        return this.getFallbackTranslation(key, options)
      }

      // Get nested translation
      const translation = this.getNestedValue(translations, key)
      if (!translation) {
        return this.getFallbackTranslation(key, options)
      }

      // Handle pluralization
      if (options.count !== undefined && typeof translation === 'object') {
        const pluralForm = this.getPluralForm(locale, options.count)
        const pluralTranslation = (translation as any)[pluralForm] || (translation as any).other
        if (pluralTranslation) {
          return this.interpolate(pluralTranslation, { ...options.interpolation, count: options.count })
        }
      }

      // Handle string translation
      if (typeof translation === 'string') {
        return this.interpolate(translation, options.interpolation)
      }

      return this.getFallbackTranslation(key, options)
    } catch (error) {
      await logger.error('Failed to get translation', {
        locale,
        key,
        options,
        error: error instanceof Error ? error.message : String(error),
      })
      return this.getFallbackTranslation(key, options)
    }
  }

  // Get nested value from object
  private getNestedValue(obj: any, path: string): any {
    return path.split('.').reduce((current, key) => current?.[key], obj)
  }

  // Get fallback translation
  private getFallbackTranslation(key: string, options: TranslationOptions): string {
    if (options.defaultValue) {
      return this.interpolate(options.defaultValue, options.interpolation)
    }
    
    // Return the key itself as last resort
    return key
  }

  // Get plural form
  private getPluralForm(locale: string, count: number): string {
    const rule = this.config.pluralization.rules[locale]
    if (!rule || !this.config.pluralization.enabled) {
      return count === 1 ? 'one' : 'other'
    }
    
    return rule(count)
  }

  // Interpolate variables in translation
  private interpolate(text: string, variables?: Record<string, any>): string {
    if (!variables) return text
    
    const { prefix, suffix, escapeValue } = this.config.interpolation
    
    return text.replace(
      new RegExp(`${this.escapeRegex(prefix)}([^${this.escapeRegex(suffix)}]+)${this.escapeRegex(suffix)}`, 'g'),
      (match, key) => {
        const value = variables[key.trim()]
        if (value === undefined || value === null) return match
        
        const stringValue = String(value)
        return escapeValue ? this.escapeHtml(stringValue) : stringValue
      }
    )
  }

  // Escape regex special characters
  private escapeRegex(text: string): string {
    return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  }

  // Escape HTML
  private escapeHtml(text: string): string {
    const htmlEscapes: Record<string, string> = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;',
    }
    
    return text.replace(/[&<>"']/g, (match) => htmlEscapes[match])
  }

  // Check if translation exists
  async hasTranslation(locale: string, key: string, namespace?: string): Promise<boolean> {
    const ns = namespace || this.config.defaultNamespace
    const namespaceKey = `${locale}:${ns}`
    
    if (!this.loadedNamespaces.has(namespaceKey)) {
      await this.loadTranslations(locale, ns)
    }
    
    const translations = this.translations.get(namespaceKey)
    if (!translations) return false
    
    return this.getNestedValue(translations, key) !== undefined
  }

  // Get all translations for a namespace
  async getNamespaceTranslations(locale: string, namespace: string): Promise<TranslationResource | null> {
    const namespaceKey = `${locale}:${namespace}`
    
    if (!this.loadedNamespaces.has(namespaceKey)) {
      await this.loadTranslations(locale, namespace)
    }
    
    return this.translations.get(namespaceKey) || null
  }

  // Clear cache
  async clearCache(locale?: string, namespace?: string): Promise<void> {
    if (locale && namespace) {
      const cacheKey = `${this.config.caching.keyPrefix}${locale}:${namespace}`
      await CacheService.delete(cacheKey)
      this.translations.delete(`${locale}:${namespace}`)
      this.loadedNamespaces.delete(`${locale}:${namespace}`)
    } else {
      // Clear all translations
      this.translations.clear()
      this.loadedNamespaces.clear()
      
      // Clear cache with pattern (if supported)
      // await CacheService.deletePattern(`${this.config.caching.keyPrefix}*`)
    }
  }
}

// Locale detector
export class LocaleDetector {
  private config: I18nConfig

  constructor(config: I18nConfig) {
    this.config = config
  }

  // Detect locale from request
  detectLocale(request: NextRequest): string {
    for (const method of this.config.detection.order) {
      const locale = this.detectFromMethod(request, method)
      if (locale && this.isValidLocale(locale)) {
        return locale
      }
    }
    
    return this.config.defaultLocale
  }

  // Detect locale from specific method
  private detectFromMethod(request: NextRequest, method: string): string | null {
    switch (method) {
      case 'cookie':
        return this.detectFromCookie(request)
      case 'header':
        return this.detectFromHeader(request)
      case 'query':
        return this.detectFromQuery(request)
      case 'path':
        return this.detectFromPath(request)
      default:
        return null
    }
  }

  // Detect from cookie
  private detectFromCookie(request: NextRequest): string | null {
    return request.cookies.get(this.config.cookieName)?.value || null
  }

  // Detect from Accept-Language header
  private detectFromHeader(request: NextRequest): string | null {
    const acceptLanguage = request.headers.get('accept-language')
    if (!acceptLanguage) return null
    
    // Parse Accept-Language header
    const languages = acceptLanguage
      .split(',')
      .map(lang => {
        const [locale, quality = '1'] = lang.trim().split(';q=')
        return { locale: locale.toLowerCase(), quality: parseFloat(quality) }
      })
      .sort((a, b) => b.quality - a.quality)
    
    // Find best matching locale
    for (const { locale } of languages) {
      // Exact match
      if (this.isValidLocale(locale)) {
        return locale
      }
      
      // Language match (e.g., 'en-US' -> 'en')
      const language = locale.split('-')[0]
      if (this.isValidLocale(language)) {
        return language
      }
    }
    
    return null
  }

  // Detect from query parameter
  private detectFromQuery(request: NextRequest): string | null {
    return request.nextUrl.searchParams.get('locale')
  }

  // Detect from URL path
  private detectFromPath(request: NextRequest): string | null {
    const pathname = request.nextUrl.pathname
    const segments = pathname.split('/').filter(Boolean)
    
    if (segments.length > 0 && this.isValidLocale(segments[0])) {
      return segments[0]
    }
    
    return null
  }

  // Check if locale is valid
  private isValidLocale(locale: string): boolean {
    return this.config.locales.includes(locale)
  }
}

// Formatting utilities
export class FormatUtils {
  // Format number
  static formatNumber(
    value: number,
    locale: string,
    options: Intl.NumberFormatOptions = {}
  ): string {
    try {
      return new Intl.NumberFormat(locale, options).format(value)
    } catch {
      return value.toString()
    }
  }

  // Format currency
  static formatCurrency(
    value: number,
    locale: string,
    currency?: string
  ): string {
    const localeInfo = getLocaleInfo(locale)
    const currencyCode = currency || localeInfo.currency
    
    return this.formatNumber(value, locale, {
      style: 'currency',
      currency: currencyCode,
    })
  }

  // Format date
  static formatDate(
    date: Date,
    locale: string,
    options: Intl.DateTimeFormatOptions = {}
  ): string {
    try {
      return new Intl.DateTimeFormat(locale, options).format(date)
    } catch {
      return date.toISOString().split('T')[0]
    }
  }

  // Format relative time
  static formatRelativeTime(
    value: number,
    unit: Intl.RelativeTimeFormatUnit,
    locale: string
  ): string {
    try {
      return new Intl.RelativeTimeFormat(locale, { numeric: 'auto' }).format(value, unit)
    } catch {
      return `${value} ${unit}${Math.abs(value) !== 1 ? 's' : ''}`
    }
  }

  // Format percentage
  static formatPercentage(
    value: number,
    locale: string,
    options: Intl.NumberFormatOptions = {}
  ): string {
    return this.formatNumber(value, locale, {
      style: 'percent',
      ...options,
    })
  }
}

// Main I18n class
export class I18n {
  private static instance: I18n
  private config: I18nConfig
  private translationManager: TranslationManager
  private localeDetector: LocaleDetector
  private currentLocale: string

  private constructor(config: Partial<I18nConfig> = {}) {
    this.config = { ...defaultConfig, ...config }
    this.translationManager = TranslationManager.getInstance(this.config)
    this.localeDetector = new LocaleDetector(this.config)
    this.currentLocale = this.config.defaultLocale
  }

  public static getInstance(config?: Partial<I18nConfig>): I18n {
    if (!I18n.instance) {
      I18n.instance = new I18n(config)
    }
    return I18n.instance
  }

  // Initialize with request
  async init(request?: NextRequest): Promise<void> {
    if (request) {
      this.currentLocale = this.localeDetector.detectLocale(request)
    }
    
    // Load default namespace
    await this.translationManager.loadTranslations(
      this.currentLocale,
      this.config.defaultNamespace
    )
  }

  // Get current locale
  getLocale(): string {
    return this.currentLocale
  }

  // Set locale
  async setLocale(locale: string): Promise<boolean> {
    if (!this.isValidLocale(locale)) {
      return false
    }
    
    this.currentLocale = locale
    
    // Load default namespace for new locale
    await this.translationManager.loadTranslations(
      locale,
      this.config.defaultNamespace
    )
    
    return true
  }

  // Translate
  async t(key: string, options?: TranslationOptions): Promise<string> {
    return this.translationManager.getTranslation(
      this.currentLocale,
      key,
      options
    )
  }

  // Check if translation exists
  async exists(key: string, namespace?: string): Promise<boolean> {
    return this.translationManager.hasTranslation(
      this.currentLocale,
      key,
      namespace
    )
  }

  // Load namespace
  async loadNamespace(namespace: string): Promise<boolean> {
    return this.translationManager.loadTranslations(
      this.currentLocale,
      namespace
    )
  }

  // Get supported locales
  getSupportedLocales(): string[] {
    return [...this.config.locales]
  }

  // Check if locale is valid
  isValidLocale(locale: string): boolean {
    return this.config.locales.includes(locale)
  }

  // Get locale info
  getLocaleInfo(locale?: string): LocaleInfo | null {
    return getLocaleInfo(locale || this.currentLocale)
  }

  // Format number
  formatNumber(value: number, options?: Intl.NumberFormatOptions): string {
    return FormatUtils.formatNumber(value, this.currentLocale, options)
  }

  // Format currency
  formatCurrency(value: number, currency?: string): string {
    return FormatUtils.formatCurrency(value, this.currentLocale, currency)
  }

  // Format date
  formatDate(date: Date, options?: Intl.DateTimeFormatOptions): string {
    return FormatUtils.formatDate(date, this.currentLocale, options)
  }

  // Format relative time
  formatRelativeTime(value: number, unit: Intl.RelativeTimeFormatUnit): string {
    return FormatUtils.formatRelativeTime(value, unit, this.currentLocale)
  }

  // Format percentage
  formatPercentage(value: number, options?: Intl.NumberFormatOptions): string {
    return FormatUtils.formatPercentage(value, this.currentLocale, options)
  }
}

// Utility functions
export function getLocaleInfo(locale: string): LocaleInfo | null {
  return localeInfo[locale] || null
}

export function isRTL(locale: string): boolean {
  const info = getLocaleInfo(locale)
  return info?.direction === 'rtl'
}

export function getLocaleCookie(locale: string): string {
  const maxAge = defaultConfig.cookieMaxAge
  const expires = new Date(Date.now() + maxAge * 1000)
  
  return `${defaultConfig.cookieName}=${locale}; Path=/; Expires=${expires.toUTCString()}; SameSite=Lax`
}

// Server-side utilities
export async function getServerLocale(): Promise<string> {
  try {
    const cookieStore = cookies()
    const localeCookie = cookieStore.get(defaultConfig.cookieName)
    
    if (localeCookie && defaultConfig.locales.includes(localeCookie.value)) {
      return localeCookie.value
    }
  } catch {
    // Ignore errors in server context
  }
  
  return defaultConfig.defaultLocale
}

export async function getServerTranslation(
  key: string,
  options?: TranslationOptions & { locale?: string }
): Promise<string> {
  const locale = options?.locale || await getServerLocale()
  const i18n = I18n.getInstance()
  
  if (i18n.getLocale() !== locale) {
    await i18n.setLocale(locale)
  }
  
  return i18n.t(key, options)
}

// Export singleton instance
export const i18n = I18n.getInstance()

// Export configuration
export { defaultConfig as i18nConfig, localeInfo }

// Export default
export default I18n