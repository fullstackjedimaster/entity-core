import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { settings } from "@/lib/settings";

/**
 * useTemplateEditor
 * Manages loading/saving entity templates without polling or auto-fetching.
 * The caller decides when to trigger loadTemplate().
 */
export function useTemplateEditor(entity: string) {
    const { getToken, isAuthenticated, loading: authLoading } = useAuth();
    const [template, setTemplate] = useState<any>(null);
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Explicitly load template (only called by user action)
    const loadTemplate = useCallback(async () => {
        if (!entity) return;
        if (authLoading) return;
        if (!isAuthenticated) {
            console.warn("⚠️ Auth not ready or user not logged in.");
            return;
        }

        setIsLoading(true);
        setError(null);
        try {
            const token = await getToken();
            if (!token) throw new Error("⚠️ Missing token (Auth0 not ready)");

            const res = await fetch(`${settings.API_BASE_URL}/api/entities/${entity}`, {
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
            });

            if (!res.ok) throw new Error(`API ${res.status}: ${await res.text()}`);
            const data = await res.json();
            setTemplate(data);
        } catch (err: any) {
            console.error("⚠️ Error loading template:", err);
            setError(err.message || "Unknown error loading template");
        } finally {
            setIsLoading(false);
        }
    }, [entity, getToken, authLoading, isAuthenticated]);

    // Save current template back to server
    const saveTemplate = useCallback(
        async (newTemplate: any) => {
            if (!entity) throw new Error("No entity provided");
            const token = await getToken();
            if (!token) throw new Error("⚠️ Missing token (Auth0 not ready)");

            const res = await fetch(`${settings.API_BASE_URL}/api/${entity}`, {
                method: "POST",
                headers: {
                    Authorization: `Bearer ${token}`,
                    "Content-Type": "application/json",
                },
                body: JSON.stringify(newTemplate),
            });

            if (!res.ok) throw new Error(`Save failed: ${res.status} ${await res.text()}`);
            const data = await res.json();
            setTemplate(data);
            return data;
        },
        [entity, getToken]
    );

    // ✅ No automatic loading here — only manual
    return { template, loadTemplate, saveTemplate, isLoading, error };
}
