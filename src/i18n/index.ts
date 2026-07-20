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
 * Detection: localStorage (`i18nextLng`) only — the user's explicit choice
 * from the switcher. First visit deliberately IGNORES the browser language
 * and lands on English (Misha's TZ: default is EN until the user picks
 * otherwise); `fallbackLng: "en"` covers both first visit and missing keys.
 *
 * `react.useSuspense: false` keeps initial paint synchronous — translations
 * are bundled (not lazy-fetched), so we don't want a Suspense boundary just
 * to wait for already-loaded JSON.
 */
export const LANGUAGES = [
  // Order is a product decision (Misha TZ §2): English first.
  { code: "en", label: "EN", name: "English" },
  { code: "es", label: "ES", name: "Español" },
  { code: "pt", label: "PT", name: "Português" },
  { code: "uk", label: "UA", name: "Українська" },
  { code: "ru", label: "RU", name: "Русский" },
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
      // No "navigator": first visit must be English regardless of browser
      // locale; only an explicit pick in the switcher changes the language.
      order: ["localStorage"],
      lookupLocalStorage: "i18nextLng",
      caches: ["localStorage"],
    },
    react: { useSuspense: false },
  })

export default i18n
