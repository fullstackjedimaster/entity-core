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
    getOrgId: () => string | null;
    getRoles: () => string[];
    auth0: Auth0ContextInterface<User> | null;
    loading: boolean;
}

/**
 * Legacy-compatible provider (no-op wrapper)
 */
export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
};

// Internal helper
type UserWithClaims = User & Record<string, unknown>;

export const useAuth = (): AuthContextType => {
    const auth0 = useAuth0<User>();
    const disableAuth = settings.DISABLE_AUTH;

    // --------------------------------------------------
    // DEV MODE (DISABLE_AUTH=true)
    // --------------------------------------------------
    if (disableAuth) {
        return {
            disableAuth: true,
            user: null,
            isAuthenticated: true,
            login: async () => {},
            logout: () => {
                if (typeof window !== 'undefined') {
                    try {
                        localStorage.clear();
                        sessionStorage.clear();
                    } catch {}
                }
            },
            getToken: async () => null,
            getIdClaims: async () => null,
            getOrgId: () => null,
            getRoles: () => [],
            auth0: null,
            loading: false,
        };
    }

    // --------------------------------------------------
    // AUTH0 MODE
    // --------------------------------------------------
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
            } catch {}
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
                authorizationParams: settings.AUTH0_AUDIENCE
                    ? { audience: settings.AUTH0_AUDIENCE }
                    : undefined,
            });

            return token ?? null;
        } catch (err: any) {
            console.warn('[Auth] token error:', err?.error || err);

            // ⚠️ Only redirect if truly required
            if (
                err?.error === 'login_required' ||
                err?.error === 'consent_required'
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
        } catch (err) {
            console.warn('[Auth] getIdClaims error:', err);
            return null;
        }
    };


    const getOrgId = (): string | null => {
        if (!user) return null;
        const claims = user as UserWithClaims;

        return (
            (claims['https://fullstackjedi.dev/org_id'] as string) ||
            (claims['org_id'] as string) ||
            null
        );
    };

    const getRoles = (): string[] => {
        if (!user) return [];
        const claims = user as UserWithClaims;

        return (
            (claims['https://fullstackjedi.dev/roles'] as string[]) ||
            (claims['roles'] as string[]) ||
            []
        );
    };

    return {
        disableAuth: false,
        user: user ?? null,
        isAuthenticated,
        login,
        logout,
        getToken,
        getIdClaims,
        getOrgId,
        getRoles,
        auth0,
        loading: isLoading,
    };
};