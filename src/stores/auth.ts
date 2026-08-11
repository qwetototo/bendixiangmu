import { defineStore } from 'pinia';
import { fetchCurrentUser, login as loginRequest, type AuthUser, type LoginPayload } from '@/services/authApi';
import { clearAuthToken, getAuthToken, persistAuthToken } from '@/services/http';

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
