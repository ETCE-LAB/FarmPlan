import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';

import enTranslation from './locales/en.json';
import deTranslation from './locales/de.json';

i18n
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: enTranslation },
      de: { translation: deTranslation }
    },
    lng: 'en',
    fallbackLng: 'en',
    returnEmptyString: false, // <--- THIS IS THE MAGIC LINE!
    interpolation: {
      escapeValue: false 
    }
  });

export default i18n;