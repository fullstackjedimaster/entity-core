// src/hooks/useOptions.ts
"use client";
import useSWR from "swr";

export type OptionItem = { value: string | number; label: string };

const fetcher = async (url: string): Promise<OptionItem[]> => {
    const res = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("access_token") || ""}` },
    });
    if (!res.ok) throw new Error(`Failed to load options: ${res.statusText}`);
    return res.json();
};

/**
 * useOptions(entity, valueCol, labelCol, filter)
 * Example:
 *   useOptions("organization", "id", "name", { parent_id: selectedParent });
 */
export function useOptions(
    entity?: string,
    valueCol?: string,
    labelCol?: string,
    filter: Record<string, any> = {},
    limit = 100
) {
    if (!entity || !valueCol || !labelCol) {
        return { options: [], isLoading: false, error: null, refresh: () => {} };
    }

    const params = new URLSearchParams({
        entity,
        value: valueCol,
        label: labelCol,
        limit: limit.toString(),
    });

    for (const [k, v] of Object.entries(filter)) {
        if (v !== undefined && v !== null) params.append(k, String(v));
    }

    const url = `/api/options?${params.toString()}`;
    const { data, error, isLoading, mutate } = useSWR<OptionItem[]>(url, fetcher);

    return {
        options: data || [],
        isLoading,
        error,
        refresh: mutate,
    };
}
