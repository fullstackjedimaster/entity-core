// src/hooks/useApiFetch.ts
import { useAuth } from "@/contexts/AuthContext";
import { apiFetchRaw } from "@/lib/api";

/**
 * React-safe wrapper that retrieves token from Auth0 context.
 */
export function useApiFetch() {
    const { getToken, isAuthenticated, disableAuth } = useAuth();

    const call = async (
        path: string,
        options: RequestInit = {}
    ): Promise<Response> => {
        if (disableAuth) return apiFetchRaw(path, null, options);
        if (!isAuthenticated) throw new Error("User not authenticated");

        const token = await getToken();
        return apiFetchRaw(path, token, options);
    };

    return { apiFetch: call };
}
