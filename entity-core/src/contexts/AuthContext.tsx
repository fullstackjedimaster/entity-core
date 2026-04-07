'use client';

import React from 'react';
import type { User } from '@auth0/auth0-react';
import {
    useAuth0,
    type Auth0ContextInterface,
} from '@auth0/auth0-react';
import { settings } from '@/lib/settings';

interface AuthContextType {
    disableAuth: boolean;
    user: User | null;
    isAuthenticated: boolean;
    login: () => Promise<void>;
    logout: () => void;
    getToken: () => Promise<string | null>;
    getIdClaims: () => Promise<Record<string, unknown> | null>;
    getSchema: () => string | null;
    auth0: Auth0ContextInterface<User> | null;
    loading: boolean;
}

/**
 * Legacy-compatible pass-through provider.
 * We no longer need a real React context here, but we keep AuthProvider for
 * any existing imports. It simply renders {children}.
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
};

// Internal helper to read schema/org from Auth0 user claims
type UserWithClaims = User & Record<string, unknown>;

export const useAuth = (): AuthContextType => {
    const auth0 = useAuth0<User>();
    const disableAuth = settings.DISABLE_AUTH === 'true';

    // 🔧 Dev mode bypass (DISABLE_AUTH=true)
    if (disableAuth) {
        return {
            disableAuth: true,
            user: null,
            isAuthenticated: true,
            login: async () => {
                // no-op
            },
            logout: () => {
                // clear local caches if any
                if (typeof window !== 'undefined') {
                    try {
                        localStorage.clear();
                        sessionStorage.clear();
                    } catch {
                        /* ignore */
                    }
                }
            },
            getToken: async () => null,
            getIdClaims: async () => null,
            getSchema: () => null,
            auth0: null,
            loading: false,
        };
    }

    const {
        isAuthenticated,
        isLoading,
        user,
        loginWithRedirect,
        logout: auth0Logout,
        getAccessTokenSilently,
        getIdTokenClaims,
    } = auth0;

    const login = async () => {
        await loginWithRedirect();
    };

    const logout = () => {
        if (typeof window !== 'undefined') {
            try {
                localStorage.clear();
                sessionStorage.clear();
            } catch {
                /* ignore */
            }
        }
        auth0Logout({
            logoutParams: {
                returnTo:
                    typeof window !== 'undefined'
                        ? window.location.origin
                        : undefined,
            },
        });
    };

    const getToken = async (): Promise<string | null> => {
        try {
            const token = await getAccessTokenSilently({
                authorizationParams: {
                    audience: process.env.NEXT_PUBLIC_AUTH0_AUDIENCE!,
                },
            });

            return token ?? null;
        } catch (err: unknown) {
            console.error('[Auth] token error:', err);
            const error = err as { error?: string };

            if (
                error.error === 'login_required' ||
                error.error === 'consent_required'
            ) {
                await login();
            }

            return null;
        }
    };

    const getIdClaims = async (): Promise<Record<string, unknown> | null> => {
        try {
            const claims = await getIdTokenClaims();
            return (claims as unknown as Record<string, unknown>) ?? null;
        } catch (err: unknown) {
            console.error('[Auth] getIdClaims error:', err);
            return null;
        }
    };

    const getSchema = (): string | null => {
        if (!user) return null;

        const claims = user as UserWithClaims;

        const schemaClaim =
            (claims['https://fullstackjedi.dev/schema'] as
                | string
                | undefined) ??
            (claims['schema'] as string | undefined) ??
            (claims['org_id'] as string | undefined);

        return schemaClaim ?? null;
    };

    return {
        disableAuth: false,
        user: user ?? null,
        isAuthenticated,
        login,
        logout,
        getToken,
        getIdClaims,
        getSchema,
        auth0,
        loading: isLoading,
    };
};
