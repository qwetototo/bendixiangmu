import { defineStore } from 'pinia';
import { ref } from 'vue';

export type Locale = 'zh-CN' | 'en';

const STORAGE_KEY = 'twintrack.locale';

function getStoredLocale(): Locale {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored === 'zh-CN' || stored === 'en') return stored;
  } catch {
    // localStorage unavailable
  }
  return 'zh-CN';
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
