"use client";

import { useState } from "react";
import { useApiFetch } from "@/hooks/useApiFetch";

interface UseSaveEntityConfig {
    entityName: string;
    primaryKey: string;
}

interface SaveResult {
    success?: boolean;
    data?: any;
    message?: string;
    [key: string]: any;
}

/**
 * useSaveEntity
 *  - Wraps calls to /api/manage_entity
 *  - Decides create vs update based on presence of primaryKey in payload
 */
export function useSaveEntity(config: UseSaveEntityConfig) {
    const { entityName, primaryKey } = config;
    const { apiFetch } = useApiFetch();

    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [result, setResult] = useState<SaveResult | null>(null);

    async function save(data: any): Promise<SaveResult> {
        setLoading(true);
        setError(null);
        try {
            const id = data?.[primaryKey] ?? null;
            const operation = id ? "update" : "create";

            const res = await apiFetch("/api/manage_entity", {
                method: "POST",
                body: JSON.stringify({
                    operation,
                    name: entityName,
                    id,
                    data,
                }),
            });

            if (!res.ok) {
                throw new Error(`Save failed: ${res.status} ${res.statusText}`);
            }

            const json = (await res.json()) as SaveResult;
            setResult(json);
            return json;
        } catch (err: any) {
            setError(err.message || "Unknown error");
            throw err;
        } finally {
            setLoading(false);
        }
    }

    return { save, loading, error, result };
}
