// hooks/useAuthInfo.ts
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";

export function useAuthInfo() {
    const {
        user,
        isAuthenticated,
        getToken,
        logout,
        login,
        disableAuth,
    } = useAuth();

    const [token, setToken] = useState<string | null>(null);
    const [claims, setClaims] = useState<Record<string, any> | null>(null);

    useEffect(() => {
        (async () => {
            if (!isAuthenticated || disableAuth) return;

            try {
                const t = await getToken();
                setToken(t);

                if (t) {
                    setClaims(parseJwt(t));
                }
            } catch (err) {
                console.warn("[useAuthInfo] Token fetch failed:", err);
            }
        })();
    }, [isAuthenticated, getToken, disableAuth]);

    const schema =
        claims?.["https://fullstackjedi.dev/schema"] ||
        claims?.["schema"] ||
        null;

    const org_id =
        claims?.["https://fullstackjedi.dev/org_id"] ||
        claims?.["org_id"] ||
        null;

    const roles =
        claims?.["https://fullstackjedi.dev/roles"] ||
        claims?.roles ||
        [];

    const permissions =
        claims?.["https://fullstackjedi.dev/permissions"] ||
        claims?.permissions ||
        [];

    return {
        user,
        token,
        claims,
        schema,
        org_id,
        roles,
        permissions,
        isAuthenticated,
        logout,
        login,
        disableAuth,
    };
}

function parseJwt(token: string): Record<string, any> {
    try {
        const [, payload] = token.split(".");
        return JSON.parse(
            atob(payload.replace(/-/g, "+").replace(/_/g, "/"))
        );
    } catch {
        return {};
    }
}