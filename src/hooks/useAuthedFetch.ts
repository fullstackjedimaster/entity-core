import { useCallback } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { settings } from '@/lib/settings';

function buildUrl(path: string): string {
    const base = settings.API_BASE_URL?.replace(/\/$/, '') ?? '';
    const cleanPath = path.startsWith('/') ? path : `/${path}`;
    return `${base}${cleanPath}`;
}

export const useAuthedFetch = () => {
    const { getToken, disableAuth } = useAuth();

    return useCallback(
        async (url: string, options: RequestInit = {}) => {
            const token = disableAuth ? null : await getToken();

            const headers = new Headers(options.headers || {});

            if (!headers.has('Content-Type') && options.body) {
                headers.set('Content-Type', 'application/json');
            }

            if (token) {
                headers.set('Authorization', `Bearer ${token}`);
            }

            return fetch(buildUrl(url), {
                ...options,
                headers,
            });
        },
        [getToken, disableAuth]
    );
};