'use client';

import { useCallback } from 'react';
import { useAuthInfo } from '@/hooks/useAuthInfo';

export function useAuthedFetch() {
  const { token, isAuthenticated, login, disableAuth } = useAuthInfo();

  return useCallback(
    async (url: string, options: RequestInit = {}) => {
      if (!disableAuth && !isAuthenticated) {
        await login();
        return;
      }

      const headers: HeadersInit = {
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      };

      if (token) {
        (headers as any).Authorization = `Bearer ${token}`;
      }

      return fetch(url, {
        ...options,
        headers,
      });
    },
    [token, isAuthenticated, login, disableAuth]
  );
}