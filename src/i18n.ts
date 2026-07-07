import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN';
import en from './locales/en';
import { useLanguageStore } from './stores/language';

const i18n = createI18n({
  legacy: false,
  // locale: 'en',
  // fallbackLocale: 'en',
  locale: 'zh-CN',
  fallbackLocale: 'zh-CN',
  messages: {
    'zh-CN': zhCN,
    en,
  },
});

export default i18n;
