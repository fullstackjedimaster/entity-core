'use client';

import React, { useEffect, useMemo, useState } from 'react';
import { Toaster } from 'sonner';

import { useFormMetadata } from '@/hooks/useFormMetadata';
import { useSaveEntity } from '@/hooks/useSaveEntity';
import { useHierarchicalOptions } from '@/hooks/useHierarchicalOptions';

type FormValues = Record<string, any>;

type EntityComponentProps = {
    entityName: string;
    initialValues?: Record<string, any>;
    onSavedAction?: (savedValues: Record<string, any>) => Promise<void> | void;
    onCancelAction?: () => void;
};

function labelize(value: string): string {
    return value.replace(/_/g, ' ');
}

function defaultValueForType(type?: string): any {
    switch ((type ?? '').toLowerCase()) {
        case 'boolean':
            return false;
        case 'number':
        case 'integer':
        case 'float':
        case 'decimal':
            return 0;
        default:
            return '';
    }
}

function cloneValue<T>(value: T): T {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value));
}

export default function EntityComponent({
    entityName,
    initialValues,
    onSavedAction,
    onCancelAction,
}: EntityComponentProps) {
    const { metadata, isLoading } = useFormMetadata(entityName);

    const [formValues, setFormValues] = useState<FormValues>(
        initialValues ? cloneValue(initialValues) : {}
    );

    const [addButtonEnabled, setAddButtonEnabled] = useState<
        Record<string, boolean>
    >({});

    const { save, loading } = useSaveEntity({
        entityName,
        primaryKey: metadata?.primaryKey ?? 'id',
    });

    useEffect(() => {
        if (initialValues) {
            setFormValues(cloneValue(initialValues));
        }
    }, [initialValues]);

    const hierarchyFields = useMemo(() => {
        return (
            metadata?.fields
                ?.map((field: any) => field.name)
                .filter((name: string) => /_hier\d+$/.test(name)) ?? []
        );
    }, [metadata]);

    const hier = useHierarchicalOptions(
        entityName,
        hierarchyFields,
        'id',
        'name'
    );

    if (isLoading) return <div>Loading form schema...</div>;
    if (!metadata) return <div>No metadata found.</div>;

    const setNestedValue = (path: string[], value: any) => {
        setFormValues((prev) => {
            const updated = cloneValue(prev) || {};
            let ref = updated;

            for (let i = 0; i < path.length - 1; i++) {
                const key = path[i];
                const nextKey = path[i + 1];
                const shouldBeArray = /^\d+$/.test(nextKey);

                if (ref[key] === undefined || ref[key] === null) {
                    ref[key] = shouldBeArray ? [] : {};
                }

                ref = ref[key];
            }

            ref[path[path.length - 1]] = value;
            return updated;
        });
    };

    const getNestedValue = (path: string[]) => {
        return path.reduce<any>((acc, key) => {
            if (acc === undefined || acc === null) return '';
            return acc[key] !== undefined ? acc[key] : '';
        }, formValues);
    };

    const handleInputChange = (
        path: string[],
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const target = e.target;

        const value =
            target instanceof HTMLInputElement && target.type === 'checkbox'
                ? target.checked
                : target.value;

        setNestedValue(path, value);
    };

    const handleAddRow = (path: string[], templateRow: Record<string, any>) => {
        const current = getNestedValue(path);
        const rows = Array.isArray(current) ? current : [];

        setNestedValue(path, [...rows, cloneValue(templateRow)]);
        setAddButtonEnabled((prev) => ({
            ...prev,
            [path.join('.')]: false,
        }));
    };

    const handleDeleteRow = (path: string[], index: number) => {
        const current = getNestedValue(path);
        const rows = Array.isArray(current) ? [...current] : [];

        rows.splice(index, 1);
        setNestedValue(path, rows.length > 0 ? rows : []);
    };

    const handleBlurRow = (path: string[], index: number) => {
        const current = getNestedValue(path);
        const rows = Array.isArray(current) ? current : [];
        const row = rows[index] ?? {};

        const allFilled = Object.values(row).every(
            (val) => val !== '' && val !== null && val !== undefined
        );

        setAddButtonEnabled((prev) => ({
            ...prev,
            [path.join('.')]: allFilled,
        }));
    };

    const renderField = (key: string, value: any, path: string[] = []) => {
        const fullPath = [...path, key];
        const fieldName = fullPath.join('.');

        if (Array.isArray(value)) {
            const templateRow =
                value.length > 0 && typeof value[0] === 'object'
                    ? value[0]
                    : {};

            const currentRows = getNestedValue(fullPath);
            const rows = Array.isArray(currentRows)
                ? currentRows
                : value.length > 0
                  ? cloneValue(value)
                  : [];

            const columns = Object.keys(templateRow);

            return (
                <div key={fieldName} className="space-y-2">
                    <h3 className="font-semibold">
                        {labelize(key).toUpperCase()}
                    </h3>

                    <table className="table-auto border border-gray-300 mb-2 w-full text-sm">
                        <thead>
                            <tr>
                                {columns.map((col) => (
                                    <th
                                        key={col}
                                        className="px-2 py-1 border border-gray-200 text-left"
                                    >
                                        {labelize(col)}
                                    </th>
                                ))}
                                <th className="px-2 py-1 border border-gray-200">
                                    Actions
                                </th>
                            </tr>
                        </thead>

                        <tbody>
                            {rows.map((row: any, index: number) => (
                                <tr key={index}>
                                    {columns.map((col) => (
                                        <td
                                            key={col}
                                            className="px-2 py-1 border border-gray-200"
                                        >
                                            <input
                                                type="text"
                                                className="w-full border rounded p-1"
                                                value={row?.[col] ?? ''}
                                                onChange={(e) =>
                                                    setNestedValue(
                                                        [
                                                            ...fullPath,
                                                            String(index),
                                                            col,
                                                        ],
                                                        e.target.value
                                                    )
                                                }
                                                onBlur={() =>
                                                    handleBlurRow(
                                                        fullPath,
                                                        index
                                                    )
                                                }
                                                disabled={loading}
                                            />
                                        </td>
                                    ))}

                                    <td className="px-2 py-1 text-center border border-gray-200">
                                        <button
                                            type="button"
                                            className="text-red-600 disabled:opacity-40"
                                            onClick={() =>
                                                handleDeleteRow(
                                                    fullPath,
                                                    index
                                                )
                                            }
                                            disabled={loading}
                                        >
                                            Delete
                                        </button>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>

                    <button
                        type="button"
                        className="text-green-700 text-sm disabled:opacity-40"
                        onClick={() => handleAddRow(fullPath, templateRow)}
                        disabled={
                            loading ||
                            (rows.length > 0 &&
                                addButtonEnabled[fieldName] === false)
                        }
                    >
                        + Add Row
                    </button>
                </div>
            );
        }

        if (typeof value === 'object' && value !== null) {
            return (
                <fieldset
                    key={fieldName}
                    className="relative border border-gray-300 p-3 rounded mt-3 space-y-2"
                >
                    <legend className="text-sm font-medium">
                        {labelize(key)}
                    </legend>

                    {Object.entries(value).map(([childKey, childValue]) =>
                        renderField(childKey, childValue, fullPath)
                    )}
                </fieldset>
            );
        }

        if (typeof value === 'boolean') {
            return (
                <label key={fieldName} className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={!!getNestedValue(fullPath)}
                        onChange={(e) => handleInputChange(fullPath, e)}
                        disabled={loading}
                    />
                    {labelize(key)}
                </label>
            );
        }

        const lowerKey = key.toLowerCase();

        if (
            lowerKey.includes('date') ||
            lowerKey.includes('dob') ||
            (typeof value === 'string' &&
                /^\d{4}-\d{2}-\d{2}$/.test(value))
        ) {
            return (
                <label key={fieldName} className="block">
                    <span className="font-medium">{labelize(key)}</span>
                    <input
                        type="date"
                        value={String(getNestedValue(fullPath) ?? '')}
                        onChange={(e) => handleInputChange(fullPath, e)}
                        className="w-full border rounded p-1 mt-1"
                        disabled={loading}
                    />
                </label>
            );
        }

        if (typeof value === 'number') {
            return (
                <label key={fieldName} className="block">
                    <span className="font-medium">{labelize(key)}</span>
                    <input
                        type="number"
                        value={String(getNestedValue(fullPath) ?? '')}
                        onChange={(e) => handleInputChange(fullPath, e)}
                        className="w-full border rounded p-1 mt-1"
                        disabled={loading}
                    />
                </label>
            );
        }

        if (hierarchyFields.includes(key)) {
            const h = hier.hooks.find((hook: any) => hook.field === key);

            return (
                <label key={fieldName} className="block">
                    <span className="font-medium">{labelize(key)}</span>
                    <select
                        name={key}
                        value={String(getNestedValue(fullPath) ?? '')}
                        onChange={(e) => {
                            const selectedValue = e.target.value || null;
                            hier.onChange(key, selectedValue);
                            setNestedValue(fullPath, selectedValue);
                        }}
                        className="w-full border rounded p-1 mt-1"
                        disabled={h?.isLoading || loading}
                    >
                        <option value="">Select...</option>
                        {h?.options?.map((opt: any) => (
                            <option key={opt.value} value={opt.value}>
                                {opt.label}
                            </option>
                        ))}
                    </select>
                </label>
            );
        }

        return (
            <label key={fieldName} className="block">
                <span className="font-medium">{labelize(key)}</span>
                <input
                    type="text"
                    value={String(getNestedValue(fullPath) ?? '')}
                    onChange={(e) => handleInputChange(fullPath, e)}
                    className="w-full border rounded p-1 mt-1"
                    disabled={loading}
                />
            </label>
        );
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        if (onSavedAction) {
            await onSavedAction(formValues);
            return;
        }

        await save(formValues);
    }

    const template =
        formValues?._template && typeof formValues._template === 'object'
            ? formValues._template
            : null;

    return (
        <form onSubmit={handleSubmit} className="grid gap-4">
            <Toaster position="bottom-center" richColors />

            <div>
                <h2 className="text-lg font-bold">Edit {entityName}</h2>
                <p className="text-sm text-gray-600">
                    Tenant schema is handled by the authenticated token.
                </p>
            </div>

            {template
                ? Object.entries(template).map(([key, value]) =>
                      renderField(key, value)
                  )
                : metadata.fields.map((field: any) =>
                      renderField(
                          field.name,
                          defaultValueForType(field.type)
                      )
                  )}

            <div className="flex gap-3">
                <button
                    type="submit"
                    className={`mt-4 px-4 py-2 rounded text-white ${
                        loading
                            ? 'bg-gray-400 cursor-wait'
                            : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    disabled={loading}
                >
                    {loading ? 'Saving...' : 'Save'}
                </button>

                {onCancelAction && (
                    <button
                        type="button"
                        onClick={onCancelAction}
                        className="mt-4 px-4 py-2 rounded border"
                        disabled={loading}
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
}