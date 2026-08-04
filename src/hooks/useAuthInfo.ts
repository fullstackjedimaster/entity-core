import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';

const NS = 'https://fullstackjedi.dev';

function parseJwt(token: string): Record<string, any> {
    try {
        const [, payload] = token.split('.');
        const normalized = payload.replace(/-/g, '+').replace(/_/g, '/');
        const padded = normalized.padEnd(
            normalized.length + ((4 - (normalized.length % 4)) % 4),
            '='
        );

        return JSON.parse(atob(padded));
    } catch {
        return {};
    }
}

function getString(claims: Record<string, any> | null, ...keys: string[]) {
    if (!claims) return null;

    for (const key of keys) {
        const value = claims[key];
        if (typeof value === 'string' && value.trim()) {
            return value;
        }
    }

    return null;
}

function getArray(claims: Record<string, any> | null, ...keys: string[]) {
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

export function useAuthInfo() {
    const {
        user,
        isAuthenticated,
        getToken,
        logout,
        login,
        disableAuth,
        getEntitySchema,
        getOrgId,
        getRoles,
        getPermissions,
    } = useAuth();

    const [token, setToken] = useState<string | null>(null);
    const [claims, setClaims] = useState<Record<string, any> | null>(null);

    useEffect(() => {
        let cancelled = false;

        async function load() {
            if (!isAuthenticated || disableAuth) return;

            try {
                const t = await getToken();
                if (cancelled) return;

                setToken(t);

                if (t) {
                    setClaims(parseJwt(t));
                }
            } catch (err) {
                console.warn('[useAuthInfo] Token fetch failed:', err);
            }
        }

        load();

        return () => {
            cancelled = true;
        };
    }, [isAuthenticated, getToken, disableAuth]);

    const authInfo = useMemo(() => {
        const entity_schema =
            getString(
                claims,
                `${NS}/entity_schema`,
                'entity_schema',
                'schema'
            ) ?? getEntitySchema();

        const org_id =
            getString(claims, `${NS}/org_id`, 'org_id') ?? getOrgId();

        const roles =
            getArray(claims, `${NS}/roles`, 'roles').length > 0
                ? getArray(claims, `${NS}/roles`, 'roles')
                : getRoles();

        const permissions =
            getArray(claims, `${NS}/permissions`, 'permissions', 'scope')
                .length > 0
                ? getArray(claims, `${NS}/permissions`, 'permissions', 'scope')
                : getPermissions();

        return {
            user,
            token,
            claims,
            roles,
            permissions,
            org_id,
            entity_schema,
            isAuthenticated,
            logout,
            login,
            disableAuth,
        };
    }, [
        user,
        token,
        claims,
        isAuthenticated,
        logout,
        login,
        disableAuth,
        getEntitySchema,
        getOrgId,
        getRoles,
        getPermissions,
    ]);

    return authInfo;
}