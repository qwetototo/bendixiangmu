import { AxiosError } from 'axios';
import { http } from '@/services/http';
import type { Result } from '@/services/adminApi';

export interface UserVO {
  id: number;
  username: string;
  userLevel: 0 | 1;
}

export interface UserWritePayload {
  username: string;
  userLevel: 0 | 1;
}

async function request<T>(method: 'get' | 'post' | 'put' | 'delete', url: string, data?: unknown): Promise<T> {
  try {
    const response = await http.request<Result<T>>({ method, url, data });
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

export function fetchUsers() {
  return request<UserVO[]>('get', '/api/users');
}

export function createUser(data: UserWritePayload) {
  return request<UserVO>('post', '/api/users', data);
}

export function updateUser(id: number, data: UserWritePayload) {
  return request<UserVO>('put', `/api/users/${id}`, data);
}

export function changeUserPassword(id: number, password: string) {
  return request<void>('put', `/api/users/${id}/password`, { password });
}

export function deleteUser(id: number) {
  return request<void>('delete', `/api/users/${id}`);
}
