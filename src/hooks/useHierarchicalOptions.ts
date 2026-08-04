'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useEntityApi, type OptionItem } from '@/lib/apiEntity';

type OptionsByField = Record<string, OptionItem[]>;
type LoadingByField = Record<string, boolean>;
type ErrorByField = Record<string, Error | null>;

type RequestPlanItem = {
    field: string;
    enabled: boolean;
    parentField?: string;
    parentValue?: string | null;
};

function hierarchyLevel(field: string): number {
    const match = field.match(/_hier(\d+)$/);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function sortHierarchyFields(fields: string[]): string[] {
    return [...fields].sort((a, b) => hierarchyLevel(a) - hierarchyLevel(b));
}

export function useHierarchicalOptions(
    baseEntityName: string,
    hierarchyFields: string[]
) {
    const api = useEntityApi();

    const sortedFields = useMemo(
        () => sortHierarchyFields(hierarchyFields),
        [hierarchyFields]
    );

    const [selectedValues, setSelectedValues] = useState<Record<string, string | null>>({});
    const [optionsByField, setOptionsByField] = useState<OptionsByField>({});
    const [loadingByField, setLoadingByField] = useState<LoadingByField>({});
    const [errorByField, setErrorByField] = useState<ErrorByField>({});

    const requestPlan = useMemo<RequestPlanItem[]>(() => {
        if (!baseEntityName || sortedFields.length === 0) {
            return [];
        }

        return sortedFields.map((field, index) => {
            if (index === 0) {
                return {
                    field,
                    enabled: true,
                };
            }

            const parentField = sortedFields[index - 1];
            const parentValue = selectedValues[parentField];

            return {
                field,
                enabled: Boolean(parentValue),
                parentField,
                parentValue,
            };
        });
    }, [baseEntityName, sortedFields, selectedValues]);

    const loadHierarchyOptions = useCallback(async () => {
        if (!baseEntityName || requestPlan.length === 0) {
            setOptionsByField({});
            setLoadingByField({});
            setErrorByField({});
            return;
        }

        const initialLoading: LoadingByField = {};
        const initialErrors: ErrorByField = {};

        for (const item of requestPlan) {
            initialLoading[item.field] = item.enabled;
            initialErrors[item.field] = null;
        }

        setLoadingByField(initialLoading);
        setErrorByField(initialErrors);

        const nextOptions: OptionsByField = {};

        await Promise.all(
            requestPlan.map(async (item) => {
                if (!item.enabled) {
                    nextOptions[item.field] = [];
                    return;
                }

                try {
                    nextOptions[item.field] = await api.getForeignKeyOptions(
                        baseEntityName,
                        item.field,
                        {
                            parentField: item.parentField,
                            parentValue: item.parentValue,
                        }
                    );
                } catch (err) {
                    nextOptions[item.field] = [];

                    setErrorByField((prev) => ({
                        ...prev,
                        [item.field]:
                            err instanceof Error
                                ? err
                                : new Error('Failed to load hierarchy options'),
                    }));
                }
            })
        );

        setOptionsByField(() => {
            const cleaned: OptionsByField = {};

            for (const field of sortedFields) {
                cleaned[field] = nextOptions[field] ?? [];
            }

            return cleaned;
        });

        setLoadingByField(() => {
            const done: LoadingByField = {};

            for (const field of sortedFields) {
                done[field] = false;
            }

            return done;
        });
    }, [api, baseEntityName, requestPlan, sortedFields]);

    useEffect(() => {
        let cancelled = false;

        async function run() {
            if (!baseEntityName || requestPlan.length === 0) {
                if (!cancelled) {
                    setOptionsByField({});
                    setLoadingByField({});
                    setErrorByField({});
                }
                return;
            }

            const initialLoading: LoadingByField = {};
            const initialErrors: ErrorByField = {};

            for (const item of requestPlan) {
                initialLoading[item.field] = item.enabled;
                initialErrors[item.field] = null;
            }

            if (!cancelled) {
                setLoadingByField(initialLoading);
                setErrorByField(initialErrors);
            }

            const nextOptions: OptionsByField = {};
            const nextErrors: ErrorByField = {};

            await Promise.all(
                requestPlan.map(async (item) => {
                    if (!item.enabled) {
                        nextOptions[item.field] = [];
                        nextErrors[item.field] = null;
                        return;
                    }

                    try {
                        nextOptions[item.field] = await api.getForeignKeyOptions(
                            baseEntityName,
                            item.field,
                            {
                                parentField: item.parentField,
                                parentValue: item.parentValue,
                            }
                        );

                        nextErrors[item.field] = null;
                    } catch (err) {
                        nextOptions[item.field] = [];
                        nextErrors[item.field] =
                            err instanceof Error
                                ? err
                                : new Error('Failed to load hierarchy options');
                    }
                })
            );

            if (!cancelled) {
                const cleanedOptions: OptionsByField = {};
                const cleanedLoading: LoadingByField = {};
                const cleanedErrors: ErrorByField = {};

                for (const field of sortedFields) {
                    cleanedOptions[field] = nextOptions[field] ?? [];
                    cleanedLoading[field] = false;
                    cleanedErrors[field] = nextErrors[field] ?? null;
                }

                setOptionsByField(cleanedOptions);
                setLoadingByField(cleanedLoading);
                setErrorByField(cleanedErrors);
            }
        }

        void run();

        return () => {
            cancelled = true;
        };
    }, [api, baseEntityName, requestPlan, sortedFields]);

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

            setOptionsByField((prev) => {
                const next = { ...prev };
                const index = sortedFields.indexOf(field);

                for (let i = index + 1; i < sortedFields.length; i++) {
                    next[sortedFields[i]] = [];
                }

                return next;
            });
        },
        [sortedFields]
    );

    const setSelectionsFromEntity = useCallback(
        (entity: Record<string, any>) => {
            const next: Record<string, string | null> = {};

            for (const field of sortedFields) {
                const value = entity?.[field];

                next[field] =
                    value === undefined || value === null || value === ''
                        ? null
                        : String(value);
            }

            setSelectedValues(next);
        },
        [sortedFields]
    );

    const clear = useCallback(() => {
        setSelectedValues({});
        setOptionsByField({});
        setLoadingByField({});
        setErrorByField({});
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

    const isLoading = useMemo(
        () => Object.values(loadingByField).some(Boolean),
        [loadingByField]
    );

    const error = useMemo(() => {
        return Object.values(errorByField).find(Boolean) ?? null;
    }, [errorByField]);

    return {
        fields: sortedFields,
        selectedValues,
        optionsByField,
        loadingByField,
        errorByField,
        isLoading,
        error,
        refresh: loadHierarchyOptions,
        onChange,
        setSelectionsFromEntity,
        clear,
        isFieldEnabled,
    };
}