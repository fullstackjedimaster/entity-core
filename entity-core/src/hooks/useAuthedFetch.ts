import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';

export const useAuthedFetch = () => {
  const { getToken } = useAuth();

  return async (url: string, options: RequestInit = {}) => {
    const token = await getToken();

    const headers = new Headers(options.headers || {});
    headers.set('Content-Type', 'application/json');

    if (token) {
      headers.set('Authorization', `Bearer ${token}`);
    }

    return fetch(url, {
      ...options,
      headers,
    });
  };
};
