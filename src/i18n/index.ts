import i18n from "i18next"
import LanguageDetector from "i18next-browser-languagedetector"
import { initReactI18next } from "react-i18next"

import en from "./locales/en.json"
import ru from "./locales/ru.json"
import uk from "./locales/uk.json"
import es from "./locales/es.json"
import pt from "./locales/pt.json"

/**
 * App-wide i18n config. Adding a language = drop a new JSON, add it to
 * `resources`, list it in `LANGUAGES` exported below.
 *
 * Detection order:
 *   1. localStorage (`i18nextLng`) — user's explicit choice from the switcher
 *   2. navigator language — fall back to browser default on first visit
 *   3. `en` — final fallback (deliberate: a missing RU/UK key reads as polish
 *      if English fills in, vs Cyrillic showing up in an English UI which
 *      reads as "we forgot to translate this"). Per user preference.
 *
 * `react.useSuspense: false` keeps initial paint synchronous — translations
 * are bundled (not lazy-fetched), so we don't want a Suspense boundary just
 * to wait for already-loaded JSON.
 */
export const LANGUAGES = [
  { code: "ru", label: "RU", name: "Русский" },
  { code: "uk", label: "UA", name: "Українська" },
  { code: "en", label: "EN", name: "English" },
  { code: "es", label: "ES", name: "Español" },
  { code: "pt", label: "PT", name: "Português" },
] as const

export type LanguageCode = (typeof LANGUAGES)[number]["code"]

export const SUPPORTED_LANGS: LanguageCode[] = LANGUAGES.map((l) => l.code) as LanguageCode[]

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ru: { translation: ru },
      uk: { translation: uk },
      es: { translation: es },
      pt: { translation: pt },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_LANGS,
    interpolation: { escapeValue: false }, // React already escapes
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "i18nextLng",
      caches: ["localStorage"],
    },
    react: { useSuspense: false },
  })

export default i18n
