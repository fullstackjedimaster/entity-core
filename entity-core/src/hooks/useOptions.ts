// src/hooks/useOptions.ts
'use client';

import useSWR from 'swr';

export type OptionItem = {
    value: string | number;
    label: string;
};

export type OptionFilter = Record<string, string | number | boolean | null | undefined>;

export function buildOptionsUrl(
    entity: string,
    valueCol: string,
    labelCol: string,
    filter: OptionFilter = {},
    limit = 100
): string {
    const params = new URLSearchParams({
        entity,
        value: valueCol,
        label: labelCol,
        limit: String(limit),
    });

    for (const [key, value] of Object.entries(filter)) {
        if (value !== undefined && value !== null && value !== '') {
            params.append(key, String(value));
        }
    }

    return `/api/options?${params.toString()}`;
}

export async function fetchOptions(url: string): Promise<OptionItem[]> {
    const token =
        typeof window !== 'undefined'
            ? localStorage.getItem('access_token') || ''
            : '';

    const res = await fetch(url, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
        throw new Error(`Failed to load options: ${res.status} ${res.statusText}`);
    }

    const payload = await res.json();

    if (Array.isArray(payload)) {
        return payload;
    }

    if (Array.isArray(payload?.options)) {
        return payload.options;
    }

    if (Array.isArray(payload?.result)) {
        return payload.result;
    }

    if (Array.isArray(payload?.result?.options)) {
        return payload.result.options;
    }

    return [];
}

export function useOptions(
    entity?: string,
    valueCol?: string,
    labelCol?: string,
    filter: OptionFilter = {},
    limit = 100
) {
    const enabled = Boolean(entity && valueCol && labelCol);

    const url = enabled
        ? buildOptionsUrl(entity!, valueCol!, labelCol!, filter, limit)
        : null;

    const { data, error, isLoading, mutate } = useSWR<OptionItem[]>(
        url,
        fetchOptions
    );

    return {
        options: data ?? [],
        isLoading,
        error,
        refresh: mutate,
    };
}