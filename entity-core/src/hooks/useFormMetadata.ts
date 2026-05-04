// src/hooks/useFormMetadata.ts
"use client";
import useSWR from "swr";
import { useApiFetch } from "@/hooks/useApiFetch";

export type FieldMeta = {
    name: string;
    label: string;
    type: string;
    required: boolean;
    widget?: string;
};

export type FormMetadata = {
    entityName: string;
    schema: string;
    table: string;
    primaryKey: string;
    fields: FieldMeta[];
};

/**
 * useFormMetadata(entity)
 * Fetches metadata for a given entity type from the CRUD server.
 * Uses the authenticated apiFetch wrapper (AuthContext).
 */
export function useFormMetadata(entityName?: string) {
    const { apiFetch } = useApiFetch();
    const shouldFetch = !!entity;

    const fetcher = async (url: string): Promise<FormMetadata> => {
        const res = await apiFetch(url);
        if (!res.ok) {
            throw new Error(`Failed to load form metadata: ${res.status} ${res.statusText}`);
        }
        return res.json();
    };

    const { data, error, isLoading, mutate } = useSWR<FormMetadata>(
        shouldFetch ? `/api/entity/${entityName}/form_metadata` : null,
        fetcher
    );

    return {
        metadata: data,
        isLoading,
        error,
        refresh: mutate,
    };
}
