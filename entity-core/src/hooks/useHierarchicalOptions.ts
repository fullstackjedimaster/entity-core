// src/hooks/useHierarchicalOptions.ts
'use client';

import { useCallback, useMemo, useState } from 'react';
import useSWR from 'swr';
import {
    buildOptionsUrl,
    fetchOptions,
    type OptionItem,
    type OptionFilter,
} from './useOptions';

type OptionsByField = Record<string, OptionItem[]>;
type LoadingByField = Record<string, boolean>;
type ErrorByField = Record<string, Error | undefined>;

function hierarchyLevel(field: string): number {
    const match = field.match(/_hier(\d+)$/);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function sortHierarchyFields(fields: string[]): string[] {
    return [...fields].sort((a, b) => hierarchyLevel(a) - hierarchyLevel(b));
}

export function useHierarchicalOptions(
    baseEntityName: string,
    hierarchyFields: string[],
    valueCol = 'id',
    labelCol = 'name',
    limit = 100
) {
    const sortedFields = useMemo(
        () => sortHierarchyFields(hierarchyFields),
        [hierarchyFields]
    );

    const [selectedValues, setSelectedValues] = useState<Record<string, string | null>>({});

    const requestPlan = useMemo(() => {
        if (!baseEntityName || sortedFields.length === 0) {
            return [];
        }

        return sortedFields.map((field, index) => {
            const filter: OptionFilter = {};
            let enabled = true;

            if (index > 0) {
                const previousField = sortedFields[index - 1];
                const previousValue = selectedValues[previousField];

                if (!previousValue) {
                    enabled = false;
                } else {
                    filter[previousField] = previousValue;
                }
            }

            return {
                field,
                enabled,
                url: enabled
                    ? buildOptionsUrl(baseEntityName, valueCol, labelCol, filter, limit)
                    : null,
            };
        });
    }, [baseEntityName, sortedFields, selectedValues, valueCol, labelCol, limit]);

    const swrKey = useMemo(() => {
        if (requestPlan.length === 0) return null;

        return JSON.stringify(
            requestPlan.map((item) => ({
                field: item.field,
                url: item.url,
                enabled: item.enabled,
            }))
        );
    }, [requestPlan]);

    const { data, error, isLoading, mutate } = useSWR<OptionsByField>(
        swrKey,
        async () => {
            const result: OptionsByField = {};

            await Promise.all(
                requestPlan.map(async (item) => {
                    if (!item.enabled || !item.url) {
                        result[item.field] = [];
                        return;
                    }

                    result[item.field] = await fetchOptions(item.url);
                })
            );

            return result;
        }
    );

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
        optionsByField: data ?? {},
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