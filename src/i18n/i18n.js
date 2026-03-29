import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import ru from '../locales/ru/translation.json'
import en from '../locales/en/translation.json'
import tg from '../locales/tg/translation.json'

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      ru: { translation: ru },
      en: { translation: en },
      tg: { translation: tg },
    },
    lng:         'ru',      // ← принудительно русский по умолчанию
    fallbackLng: 'ru',
    supportedLngs: ['ru', 'en', 'tg'],
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      caches: ['localStorage'],
      lookupLocalStorage: 'furnicraft_lang',
    },
  })

export default i18n