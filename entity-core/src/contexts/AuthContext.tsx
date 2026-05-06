'use client';

import React, { useCallback } from 'react';
import type { User } from '@auth0/auth0-react';
import {
    useAuth0,
    type Auth0ContextInterface,
} from '@auth0/auth0-react';
import { settings } from '@/lib/settings';

const NS = 'https://fullstackjedi.dev';

const CLAIMS = {
    entitySchema: `${NS}/entity_schema`,
    orgId: `${NS}/org_id`,
    roles: `${NS}/roles`,
    permissions: `${NS}/permissions`,
};

type Claims = Record<string, unknown>;
type UserWithClaims = User & Claims;

interface AuthContextType {
    disableAuth: boolean;
    user: User | null;
    claims: Claims | null;
    isAuthenticated: boolean;
    login: () => Promise<void>;
    logout: () => void;
    getToken: () => Promise<string | null>;
    getIdClaims: () => Promise<Claims | null>;
    getEntitySchema: () => string | null;
    getOrgId: () => string | null;
    getRoles: () => string[];
    getPermissions: () => string[];
    auth0: Auth0ContextInterface<User> | null;
    loading: boolean;
}

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    return <>{children}</>;
};

function claimString(claims: Claims | null | undefined, ...keys: string[]): string | null {
    if (!claims) return null;

    for (const key of keys) {
        const value = claims[key];
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
    }

    return null;
}

function claimStringArray(claims: Claims | null | undefined, ...keys: string[]): string[] {
    if (!claims) return [];

    for (const key of keys) {
        const value = claims[key];

        if (Array.isArray(value)) {
            return value.map(String);
        }

        if (typeof value === 'string' && value.trim()) {
            return value.split(/\s+/).filter(Boolean);
        }
    }

    return [];
}

export const useAuth = (): AuthContextType => {
    const auth0 = useAuth0<User>();
    const disableAuth = settings.DISABLE_AUTH;

    if (disableAuth) {
        return {
            disableAuth: true,
            user: null,
            claims: {
                entity_schema: settings.DEFAULT_ENTITY_SCHEMA ?? 'public',
                org_id: 'dev',
                roles: ['admin'],
                permissions: [
                    'crud:create',
                    'crud:read',
                    'crud:update',
                    'crud:delete',
                ],
            },
            isAuthenticated: true,
            login: async () => {},
            logout: () => {
                if (typeof window !== 'undefined') {
                    localStorage.clear();
                    sessionStorage.clear();
                }
            },
            getToken: async () => null,
            getIdClaims: async () => null,
            getEntitySchema: () => settings.DEFAULT_ENTITY_SCHEMA ?? 'public',
            getOrgId: () => 'dev',
            getRoles: () => ['admin'],
            getPermissions: () => [
                'crud:create',
                'crud:read',
                'crud:update',
                'crud:delete',
            ],
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

    const userClaims = (user ?? null) as UserWithClaims | null;

    const login = useCallback(async () => {
        await loginWithRedirect({
            authorizationParams: settings.AUTH0_AUDIENCE
                ? {
                      audience: settings.AUTH0_AUDIENCE,
                      scope: settings.AUTH0_SCOPE,
                  }
                : {
                      scope: settings.AUTH0_SCOPE,
                  },
        });
    }, [loginWithRedirect]);

    const logout = useCallback(() => {
        if (typeof window !== 'undefined') {
            localStorage.clear();
            sessionStorage.clear();
        }

        auth0Logout({
            logoutParams: {
                returnTo:
                    typeof window !== 'undefined'
                        ? window.location.origin
                        : undefined,
            },
        });
    }, [auth0Logout]);

    const getToken = useCallback(async (): Promise<string | null> => {
        try {
            const token = await getAccessTokenSilently({
                authorizationParams: settings.AUTH0_AUDIENCE
                    ? {
                          audience: settings.AUTH0_AUDIENCE,
                          scope: settings.AUTH0_SCOPE,
                      }
                    : {
                          scope: settings.AUTH0_SCOPE,
                      },
            });

            return token ?? null;
        } catch (err: any) {
            console.warn('[Auth] token error:', err?.error || err);

            if (
                err?.error === 'login_required' ||
                err?.error === 'consent_required'
            ) {
                await login();
            }

            return null;
        }
    }, [getAccessTokenSilently, login]);

    const getIdClaims = useCallback(async (): Promise<Claims | null> => {
        try {
            const claims = await getIdTokenClaims();
            return (claims as unknown as Claims) ?? null;
        } catch (err) {
            console.warn('[Auth] getIdClaims error:', err);
            return null;
        }
    }, [getIdTokenClaims]);

    const getEntitySchema = useCallback((): string | null => {
        return claimString(
            userClaims,
            CLAIMS.entitySchema,
            'entity_schema',
            'schema'
        );
    }, [userClaims]);

    const getOrgId = useCallback((): string | null => {
        return claimString(userClaims, CLAIMS.orgId, 'org_id');
    }, [userClaims]);

    const getRoles = useCallback((): string[] => {
        return claimStringArray(userClaims, CLAIMS.roles, 'roles');
    }, [userClaims]);

    const getPermissions = useCallback((): string[] => {
        return claimStringArray(
            userClaims,
            CLAIMS.permissions,
            'permissions',
            'scope'
        );
    }, [userClaims]);

    return {
        disableAuth: false,
        user: user ?? null,
        claims: userClaims,
        isAuthenticated,
        login,
        logout,
        getToken,
        getIdClaims,
        getEntitySchema,
        getOrgId,
        getRoles,
        getPermissions,
        auth0,
        loading: isLoading,
    };
};