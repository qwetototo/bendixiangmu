import { createI18n } from 'vue-i18n';
import zhCN from './locales/zh-CN';
import en from './locales/en';

/** 默认语言，由构建环境变量 VITE_DEFAULT_LOCALE 控制 */
const defaultLocale: 'zh-CN' | 'en' =
  (import.meta.env.VITE_DEFAULT_LOCALE as 'zh-CN' | 'en' | undefined) ?? 'zh-CN';

const i18n = createI18n({
  legacy: false,
  locale: defaultLocale,
  fallbackLocale: defaultLocale,
  messages: {
    'zh-CN': zhCN,
    en,
  },
});

export default i18n;
