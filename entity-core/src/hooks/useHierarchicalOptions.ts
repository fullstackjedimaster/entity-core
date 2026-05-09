// entity-core/src/hooks/useHierarchicalOptions.ts
'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';

export type OptionItem = {
    value: string | number;
    label: string;
};

type OptionsByField = Record<string, OptionItem[]>;
type LoadingByField = Record<string, boolean>;
type ErrorByField = Record<string, Error | undefined>;

type RequestPlanItem = {
    field: string;
    enabled: boolean;
    url: string | null;
};

function hierarchyLevel(field: string): number {
    const match = field.match(/_hier(\d+)$/);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function sortHierarchyFields(fields: string[]): string[] {
    return [...fields].sort((a, b) => hierarchyLevel(a) - hierarchyLevel(b));
}

function normalizeOptionsPayload(payload: unknown): OptionsByField {
    if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
        return {};
    }

    const result: OptionsByField = {};

    for (const [field, rawOptions] of Object.entries(payload)) {
        if (!Array.isArray(rawOptions)) {
            result[field] = [];
            continue;
        }

        result[field] = rawOptions.map((item: any) => ({
            value: item.value ?? item.id ?? item.uuid ?? item.key ?? '',
            label: item.label ?? item.name ?? item.title ?? item.value ?? item.id ?? '',
        }));
    }

    return result;
}

async function fetchForeignKeyOptions(url: string): Promise<OptionsByField> {
    const token =
        typeof window !== 'undefined'
            ? localStorage.getItem('access_token') || ''
            : '';

    const res = await fetch(url, {
        method: 'GET',
        headers: {
            Accept: 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
    });

    if (!res.ok) {
        throw new Error(
            `Failed to load foreign key options: ${res.status} ${res.statusText}`
        );
    }

    const payload = await res.json();
    return normalizeOptionsPayload(payload);
}

function buildForeignKeyOptionsUrl(
    entityName: string,
    field: string,
    parentField?: string,
    parentValue?: string | null
): string {
    const params = new URLSearchParams({
        entity: entityName,
        field,
    });

    if (parentField && parentValue) {
        params.set('parentField', parentField);
        params.set('parentValue', parentValue);
    }

    return `/api/foreign-key-options?${params.toString()}`;
}

export function useHierarchicalOptions(
    baseEntityName: string,
    hierarchyFields: string[]
) {
    const sortedFields = useMemo(
        () => sortHierarchyFields(hierarchyFields),
        [hierarchyFields]
    );

    const [selectedValues, setSelectedValues] = useState<Record<string, string | null>>({});

    const requestPlan = useMemo<RequestPlanItem[]>(() => {
        if (!baseEntityName || sortedFields.length === 0) {
            return [];
        }

        return sortedFields.map((field, index) => {
            if (index === 0) {
                return {
                    field,
                    enabled: true,
                    url: buildForeignKeyOptionsUrl(baseEntityName, field),
                };
            }

            const parentField = sortedFields[index - 1];
            const parentValue = selectedValues[parentField];

            if (!parentValue) {
                return {
                    field,
                    enabled: false,
                    url: null,
                };
            }

            return {
                field,
                enabled: true,
                url: buildForeignKeyOptionsUrl(
                    baseEntityName,
                    field,
                    parentField,
                    parentValue
                ),
            };
        });
    }, [baseEntityName, sortedFields, selectedValues]);

    const swrKey = useMemo(() => {
        if (requestPlan.length === 0) return null;

        return JSON.stringify(
            requestPlan.map((item) => ({
                field: item.field,
                enabled: item.enabled,
                url: item.url,
            }))
        );
    }, [requestPlan]);

    const {
        data,
        error,
        isLoading,
        mutate,
    } = useSWR<OptionsByField>(swrKey, async () => {
        const result: OptionsByField = {};

        await Promise.all(
            requestPlan.map(async (item) => {
                if (!item.enabled || !item.url) {
                    result[item.field] = [];
                    return;
                }

                const payload = await fetchForeignKeyOptions(item.url);
                result[item.field] = payload[item.field] ?? [];
            })
        );

        return result;
    });

    const optionsByField = useMemo<OptionsByField>(() => {
        const result: OptionsByField = {};

        for (const field of sortedFields) {
            result[field] = data?.[field] ?? [];
        }

        return result;
    }, [data, sortedFields]);

    const loadingByField = useMemo<LoadingByField>(() => {
        const result: LoadingByField = {};

        for (const item of requestPlan) {
            result[item.field] = item.enabled && isLoading;
        }

        return result;
    }, [requestPlan, isLoading]);

    const errorByField = useMemo<ErrorByField>(() => {
        const result: ErrorByField = {};

        for (const item of requestPlan) {
            result[item.field] = item.enabled ? error : undefined;
        }

        return result;
    }, [requestPlan, error]);

    const onChange = useCallback(
        (field: string, value: string | null) => {
            setSelectedValues((prev) => {
                const next: Record<string, string | null> = {
                    ...prev,
                    [field]: value,
                };

                const index = sortedFields.indexOf(field);

                for (let i = index + 1; i < sortedFields.length; i++) {
                    next[sortedFields[i]] = null;
                }

                return next;
            });
        },
        [sortedFields]
    );

    const setSelectionsFromEntity = useCallback(
        (entity: Record<string, any>) => {
            setSelectedValues(() => {
                const next: Record<string, string | null> = {};

                for (const field of sortedFields) {
                    const value = entity?.[field];

                    next[field] =
                        value === undefined || value === null || value === ''
                            ? null
                            : String(value);
                }

                return next;
            });
        },
        [sortedFields]
    );

    const clear = useCallback(() => {
        setSelectedValues({});
    }, []);

    const isFieldEnabled = useCallback(
        (field: string) => {
            const index = sortedFields.indexOf(field);

            if (index <= 0) return true;

            const previousField = sortedFields[index - 1];
            return Boolean(selectedValues[previousField]);
        },
        [sortedFields, selectedValues]
    );

    return {
        fields: sortedFields,
        selectedValues,
        optionsByField,
        loadingByField,
        errorByField,
        isLoading,
        error,
        refresh: mutate,
        onChange,
        setSelectionsFromEntity,
        clear,
        isFieldEnabled,
    };
}