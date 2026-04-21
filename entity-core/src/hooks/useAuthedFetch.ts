import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export function useAuthedFetch() {
  const { getToken, isAuthenticated, login, disableAuth } = useAuth();

  return useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!disableAuth && !isAuthenticated) {
        await login();
        throw new Error('Not authenticated');
      }

      const token = await getToken(); // 🔥 ALWAYS fetch fresh token

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };

      if (token) {
        headers.Authorization = `Bearer ${token}`;
      }

      return fetch(url, {
        ...options,
        headers,
      });
    },
    [getToken, isAuthenticated, login, disableAuth]
  );
}