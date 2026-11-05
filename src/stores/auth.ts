import { defineStore } from 'pinia';
import { fetchCurrentUser, login as loginRequest, type AuthUser, type LoginPayload } from '@/services/authApi';
import { clearAuthToken, getAuthToken, persistAuthToken } from '@/services/http';

export function isLocalPreviewMode(): boolean {
  return import.meta.env.DEV
    && typeof window !== 'undefined'
    && new URLSearchParams(window.location.search).get('preview') === '1';
}

export const useAuthStore = defineStore('auth', {
  state: () => ({
    user: null as AuthUser | null,
    initialized: false,
  }),
  getters: {
    isAuthenticated: (state) => state.user !== null,
    isAdmin: (state) => state.user?.userLevel === 0,
  },
  actions: {
    async initialize() {
      if (isLocalPreviewMode()) {
        this.user = { id: 0, username: 'local-preview', userLevel: 0 };
        this.initialized = true;
        return;
      }
      if (!getAuthToken()) {
        this.initialized = true;
        return;
      }
      try {
        this.user = await fetchCurrentUser();
      } catch {
        clearAuthToken();
        this.user = null;
      } finally {
        this.initialized = true;
      }
    },
    async login(payload: LoginPayload) {
      const result = await loginRequest(payload);
      persistAuthToken(result.token, payload.remember);
      this.user = result.user;
      this.initialized = true;
    },
    logout() {
      clearAuthToken();
      this.user = null;
      this.initialized = true;
    },
  },
});
