import { defineStore } from 'pinia';
import { ref } from 'vue';

export type Locale = 'zh-CN' | 'en';

const STORAGE_KEY = 'twintrack.locale';

/** 构建时通过 VITE_DEFAULT_LOCALE 设定的默认语言 */
const buildDefaultLocale: Locale =
  (import.meta.env.VITE_DEFAULT_LOCALE as Locale | undefined) ?? 'zh-CN';

function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh-CN' || stored === 'en') return stored;
  } catch {
    // localStorage unavailable
  }
  return buildDefaultLocale;
}

export const useLanguageStore = defineStore('language', () => {
  const locale = ref<Locale>(getStoredLocale());

  function setLocale(next: Locale) {
    locale.value = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // localStorage unavailable
    }
  }

  function toggle() {
    setLocale(locale.value === 'zh-CN' ? 'en' : 'zh-CN');
  }

  return { locale, setLocale, toggle };
});
