import type { AuthResult } from './types';

const API_BASE = '/api/v1';

class ApiError extends Error {
  constructor(public status: number, public body: unknown) {
    super(`API error ${status}`);
  }
}

function getToken(): string | null {
  return localStorage.getItem('jtk25_admin_token');
}

export function setToken(token: string) {
  localStorage.setItem('jtk25_admin_token', token);
}

export function clearToken() {
  localStorage.removeItem('jtk25_admin_token');
}

export function isGlobalAdmin(): boolean {
  return localStorage.getItem('jtk25_admin_scope') === 'global';
}

export function getAdminScope(): string | null {
  return localStorage.getItem('jtk25_admin_scope');
}

export function setAdminScope(scope: string) {
  localStorage.setItem('jtk25_admin_scope', scope);
}

async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...((options.headers as Record<string, string>) || {}),
  };
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  if (res.status === 204) return undefined as T;

  const body = await res.json().catch(() => null);

  if (!res.ok) {
    if (res.status === 401 || res.status === 403) {
      clearToken();
    }
    throw new ApiError(res.status, body);
  }

  return body as T;
}

export const apiClient = {
  get: <T>(path: string) => api<T>(path),
  post: <T>(path: string, data: unknown) =>
    api<T>(path, { method: 'POST', body: JSON.stringify(data) }),
  put: <T>(path: string, data: unknown) =>
    api<T>(path, { method: 'PUT', body: JSON.stringify(data) }),
  delete: <T>(path: string) => api<T>(path, { method: 'DELETE' }),
};

export async function authenticate(password: string): Promise<AuthResult> {
  const res = await apiClient.post<AuthResult>('/admin/auth', { password });
  return res;
}

export async function notifySchedule(classes: string[]): Promise<void> {
  if (classes.length === 0) return;
  await apiClient.post('/admin/notify', { classes });
}

export async function notifyPengganti(classes: string[]): Promise<void> {
  if (classes.length === 0) return;
  await apiClient.post('/admin/notify/pengganti', { classes });
}

export async function notifyCalendar(classes: string[]): Promise<void> {
  if (classes.length === 0) return;
  await apiClient.post('/admin/notify/calendar', { classes });
}
