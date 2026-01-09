/**
 * i18n - Internationalization
 *
 * Uses shared JSON locale files from /locales/ directory.
 * Both frontend and backend use the same translation files.
 */

import de from '../../../locales/de.json';
import en from '../../../locales/en.json';
import fr from '../../../locales/fr.json';
import ru from '../../../locales/ru.json';
import pt from '../../../locales/pt.json';
import es from '../../../locales/es.json';
import tr from '../../../locales/tr.json';
import pl from '../../../locales/pl.json';
import { storage } from '../utils/storage';

type Translations = typeof de;
type TranslationKey = string;

const locales: Record<string, Translations> = { de, en, fr, ru, pt, es, tr, pl };

const DEFAULT_LANGUAGE = 'en';
const SUPPORTED_LANGUAGES = ['de', 'en', 'fr', 'ru', 'pt', 'es', 'tr', 'pl'] as const;
export type Language = typeof SUPPORTED_LANGUAGES[number];

let currentLanguage: Language = DEFAULT_LANGUAGE;

/**
 * Initialize i18n with language from storage or server
 */
export function initI18n(language?: string): void {
  if (language && isValidLanguage(language)) {
    currentLanguage = language;
  } else {
    const stored = storage.get('language', '');
    if (stored && isValidLanguage(stored)) {
      currentLanguage = stored;
    } else {
      // Fallback to browser language or default
      const browserLang = navigator.language?.split('-')[0] || '';
      currentLanguage = isValidLanguage(browserLang) ? browserLang : DEFAULT_LANGUAGE;
    }
  }
}

/**
 * Get current language
 */
export function getLanguage(): Language {
  return currentLanguage;
}

/**
 * Set current language
 */
export function setLanguage(language: Language): void {
  if (isValidLanguage(language)) {
    currentLanguage = language;
    storage.set('language', language);
  }
}

/**
 * Check if language is valid
 */
export function isValidLanguage(lang: string): lang is Language {
  return SUPPORTED_LANGUAGES.includes(lang as Language);
}

/**
 * Get all supported languages
 */
export function getSupportedLanguages(): readonly Language[] {
  return SUPPORTED_LANGUAGES;
}

/**
 * Get the full translations object for the current language
 */
export function getTranslations(): Translations {
  return locales[currentLanguage] || locales[DEFAULT_LANGUAGE];
}

/**
 * Translate a key
 * @param key - Dot-notated key like "settings.title"
 * @param params - Optional parameters for interpolation
 */
export function t(key: TranslationKey, params?: Record<string, string | number>): string {
  const translations = locales[currentLanguage] || locales[DEFAULT_LANGUAGE];
  const keys = key.split('.');

  let result: unknown = translations;
  for (const k of keys) {
    if (result && typeof result === 'object' && k in result) {
      result = (result as Record<string, unknown>)[k];
    } else {
      console.warn(`[i18n] Missing translation: ${key}`);
      return key;
    }
  }

  if (typeof result !== 'string') {
    console.warn(`[i18n] Translation is not a string: ${key}`);
    return key;
  }

  // Simple parameter interpolation: {{param}}
  if (params) {
    return result.replace(/\{\{(\w+)\}\}/g, (_, name) =>
      String(params[name] ?? `{{${name}}}`)
    );
  }

  return result;
}
