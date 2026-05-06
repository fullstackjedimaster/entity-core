// src/hooks/useFormMetadata.ts
"use client";
import useSWR from "swr";
import { useEntityApi } from "@/lib/apiEntity";

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
export function useFormMetadata(entityName: string) {
      const api = useEntityApi();

    const data = api.getFormMetadata(entityName);
    return {
        formMetadata: data

    };
}
