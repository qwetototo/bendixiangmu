import { AxiosError } from 'axios';
import { http } from '@/services/http';
import type { Result } from '@/services/adminApi';

export interface AuthUser {
  id: number;
  username: string;
  userLevel: 0 | 1;
}

export interface LoginPayload {
  username: string;
  password: string;
  remember: boolean;
}

export interface LoginResult {
  token: string;
  expiresAt: number;
  user: AuthUser;
}

async function unwrap<T>(request: Promise<{ data: Result<T> }>): Promise<T> {
  try {
    const response = await request;
    if (response.data.status !== 200) throw new Error(response.data.message || '请求失败');
    return response.data.data;
  } catch (error) {
    if (error instanceof AxiosError) {
      const result = error.response?.data as Partial<Result<unknown>> | undefined;
      throw new Error(result?.message || error.message || '请求失败');
    }
    throw error;
  }
}

export function login(payload: LoginPayload) {
  return unwrap<LoginResult>(http.post('/api/auth/login', payload));
}

export function fetchCurrentUser() {
  return unwrap<AuthUser>(http.get('/api/auth/me'));
}
