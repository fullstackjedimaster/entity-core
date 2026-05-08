'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Toaster } from 'sonner';

import { useFormMetadata } from '@/hooks/useFormMetadata';
import { useSaveEntity } from '@/hooks/useSaveEntity';
import { useHierarchicalOptions } from '@/hooks/useHierarchicalOptions';

type Entity = Record<string, any>;

type EntityComponentProps = {
    entityName: string;
    id?: string;
    initialValues?: Entity;
    onSavedAction?: (savedEntity: Entity) => Promise<void> | void;
    onCancelAction?: () => void;
};

const ZERO_UUID = '00000000-0000-0000-0000-000000000000';

function labelize(value: string): string {
    return value.replace(/_/g, ' ');
}

function cloneValue<T>(value: T): T {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value));
}

function normalizeLoadedEntity(payload: any): Entity {
    if (!payload) return {};

    if (payload.entity && typeof payload.entity === 'object') {
        return cloneValue(payload.entity);
    }

    if (payload.result?.entity && typeof payload.result.entity === 'object') {
        return cloneValue(payload.result.entity);
    }

    if (payload.result?.data && typeof payload.result.data === 'object') {
        return cloneValue(payload.result.data);
    }

    if (payload.data && typeof payload.data === 'object') {
        return cloneValue(payload.data);
    }

    if (typeof payload === 'object') {
        return cloneValue(payload);
    }

    return {};
}

function extractEntityJson(metadata: any, entityName: string): Entity | null {
    const raw =
        metadata?.entity_json ??
        metadata?.entityJson ??
        metadata?.result?.entity_json ??
        metadata?.result?.entityJson ??
        metadata?.data?.entity_json ??
        metadata?.data?.entityJson ??
        null;

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
        return null;
    }

    const entityJson =
        raw[entityName] && typeof raw[entityName] === 'object'
            ? raw[entityName]
            : raw;

    return cloneValue(entityJson);
}

function defaultValueFromShape(value: any): any {
    if (Array.isArray(value)) {
        return [];
    }

    if (value !== null && typeof value === 'object') {
        const result: Entity = {};

        for (const [key, childValue] of Object.entries(value)) {
            result[key] = defaultValueFromShape(childValue);
        }

        return result;
    }

    if (typeof value === 'boolean') return false;
    if (typeof value === 'number') return 0;

    return '';
}

function buildEntityFromEntityJson(metadata: any, entityName: string): Entity {
    const entityJson = extractEntityJson(metadata, entityName);

    if (!entityJson) {
        return {};
    }

    const entity: Entity = {};

    for (const [key, value] of Object.entries(entityJson)) {
        entity[key] = defaultValueFromShape(value);
    }

    return entity;
}

function defaultValueForMetadataField(field: any): any {
    const type = String(field?.type ?? '').toLowerCase();

    switch (type) {
        case 'boolean':
        case 'bool':
            return false;

        case 'number':
        case 'integer':
        case 'int':
        case 'float':
        case 'decimal':
        case 'numeric':
            return 0;

        case 'json':
        case 'jsonb':
            return {};

        default:
            return '';
    }
}

function buildEntityFromMetadata(metadata: any): Entity {
    const entity: Entity = {};

    for (const field of metadata?.fields ?? []) {
        entity[field.name] = defaultValueForMetadataField(field);
    }

    return entity;
}

function buildNewEntity(metadata: any, entityName: string): Entity {
    const fromEntityJson = buildEntityFromEntityJson(metadata, entityName);

    if (Object.keys(fromEntityJson).length > 0) {
        return fromEntityJson;
    }

    return buildEntityFromMetadata(metadata);
}

function mergeEntityValuesIntoShape(shape: any, values: any): any {
    if (Array.isArray(shape)) {
        const templateRow =
            shape.length > 0 && typeof shape[0] === 'object' && shape[0] !== null
                ? shape[0]
                : {};

        if (!Array.isArray(values)) {
            return [];
        }

        return values.map((row) => {
            if (
                row &&
                typeof row === 'object' &&
                !Array.isArray(row) &&
                templateRow &&
                typeof templateRow === 'object'
            ) {
                return mergeEntityValuesIntoShape(templateRow, row);
            }

            return row;
        });
    }

    if (shape !== null && typeof shape === 'object') {
        const merged: Entity = {};

        for (const [key, childShape] of Object.entries(shape)) {
            const childValue =
                values && typeof values === 'object' && key in values
                    ? values[key]
                    : undefined;

            merged[key] =
                childValue === undefined
                    ? defaultValueFromShape(childShape)
                    : mergeEntityValuesIntoShape(childShape, childValue);
        }

        return merged;
    }

    if (values === undefined || values === null) {
        return defaultValueFromShape(shape);
    }

    return values;
}

function buildRenderShape(metadata: any, entityName: string): Entity {
    const entityJson = extractEntityJson(metadata, entityName);

    if (entityJson && Object.keys(entityJson).length > 0) {
        return entityJson;
    }

    return buildEntityFromMetadata(metadata);
}

function normalizeEntityForSave(entityValue: Entity, metadata: any): Entity {
    const normalized = cloneValue(entityValue) || {};

    for (const field of metadata?.fields ?? []) {
        const type = String(field?.type ?? '').toLowerCase();

        if (
            (type === 'json' || type === 'jsonb') &&
            normalized[field.name] === ''
        ) {
            normalized[field.name] = {};
        }
    }

    return normalized;
}

export default function EntityComponent({
    entityName,
    id,
    initialValues,
    onSavedAction,
    onCancelAction,
}: EntityComponentProps) {
    const itemId = id || ZERO_UUID;
    const isNewEntity = itemId === ZERO_UUID;

    const { metadata, isLoading: metadataLoading } = useFormMetadata(entityName);

    const [entity, setEntity] = useState<Entity>({});
    const [entityLoading, setEntityLoading] = useState(true);
    const [entityError, setEntityError] = useState<string | null>(null);
    const [addButtonEnabled, setAddButtonEnabled] = useState<Record<string, boolean>>({});

    const { save, loading: saving } = useSaveEntity({
        entityName,
        primaryKey: metadata?.primaryKey ?? 'id',
    });

    const hierarchyFields = useMemo(() => {
        return (
            metadata?.fields
                ?.map((field: any) => field.name)
                .filter((name: string) => /_hier\d+$/.test(name)) ?? []
        );
    }, [metadata]);

    const hier = useHierarchicalOptions(entityName, hierarchyFields, 'id', 'name');

    const renderShape = useMemo(() => {
        if (!metadata) return {};
        return buildRenderShape(metadata, entityName);
    }, [metadata, entityName]);

    const loadEntity = useCallback(async () => {
        if (!metadata) return;

        setEntityLoading(true);
        setEntityError(null);

        try {
            if (initialValues) {
                setEntity(
                    mergeEntityValuesIntoShape(
                        buildRenderShape(metadata, entityName),
                        initialValues
                    )
                );
                return;
            }

            if (isNewEntity) {
                setEntity(buildNewEntity(metadata, entityName));
                return;
            }

            const response = await fetch('/api/manage', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    operation: 'read',
                    target: entityName,
                    id: itemId,
                    args: {},
                    meta: {
                        source: 'EntityComponent.loadEntity',
                    },
                }),
            });

            if (!response.ok) {
                throw new Error(`Load failed: ${response.status} ${response.statusText}`);
            }

            const payload = await response.json();
            const loadedEntity = normalizeLoadedEntity(payload);

            setEntity(
                Object.keys(loadedEntity).length > 0
                    ? mergeEntityValuesIntoShape(
                          buildRenderShape(metadata, entityName),
                          loadedEntity
                      )
                    : buildNewEntity(metadata, entityName)
            );
        } catch (err) {
            console.error(`Error loading ${entityName}:`, err);
            setEntityError(err instanceof Error ? err.message : 'Unable to load entity');
            setEntity(buildNewEntity(metadata, entityName));
        } finally {
            setEntityLoading(false);
        }
    }, [entityName, itemId, initialValues, isNewEntity, metadata]);

    useEffect(() => {
        void loadEntity();
    }, [loadEntity]);

    const setEntityPath = (path: string[], value: any) => {
        setEntity((prev) => {
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

    const readEntityPath = (path: string[]) => {
        return path.reduce<any>((acc, key) => {
            if (acc === undefined || acc === null) return '';
            return acc[key] !== undefined ? acc[key] : '';
        }, entity);
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

        setEntityPath(path, value);
    };

    const handleAddRow = (path: string[], templateRow: Entity) => {
        const current = readEntityPath(path);
        const rows = Array.isArray(current) ? current : [];

        setEntityPath(path, [...rows, defaultValueFromShape(templateRow)]);
        setAddButtonEnabled((prev) => ({
            ...prev,
            [path.join('.')]: false,
        }));
    };

    const handleDeleteRow = (path: string[], index: number) => {
        const current = readEntityPath(path);
        const rows = Array.isArray(current) ? [...current] : [];

        rows.splice(index, 1);
        setEntityPath(path, rows);
    };

    const handleBlurRow = (path: string[], index: number) => {
        const current = readEntityPath(path);
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

    const renderField = (key: string, shapeValue: any, path: string[] = []) => {
        const fullPath = [...path, key];
        const fieldName = fullPath.join('.');
        const disabled = saving || entityLoading;

        if (Array.isArray(shapeValue)) {
            const templateRow =
                shapeValue.length > 0 &&
                typeof shapeValue[0] === 'object' &&
                shapeValue[0] !== null
                    ? shapeValue[0]
                    : {};

            const currentRows = readEntityPath(fullPath);
            const rows = Array.isArray(currentRows) ? currentRows : [];
            const columns = Object.keys(templateRow);

            return (
                <div key={fieldName} className="space-y-2">
                    <h3 className="font-semibold">{labelize(key).toUpperCase()}</h3>

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
                                                    setEntityPath(
                                                        [...fullPath, String(index), col],
                                                        e.target.value
                                                    )
                                                }
                                                onBlur={() => handleBlurRow(fullPath, index)}
                                                disabled={disabled}
                                            />
                                        </td>
                                    ))}

                                    <td className="px-2 py-1 text-center border border-gray-200">
                                        <button
                                            type="button"
                                            className="text-red-600 disabled:opacity-40"
                                            onClick={() => handleDeleteRow(fullPath, index)}
                                            disabled={disabled}
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
                            disabled ||
                            (rows.length > 0 && !addButtonEnabled[fieldName])
                        }
                    >
                        + Add Row
                    </button>
                </div>
            );
        }

        if (typeof shapeValue === 'object' && shapeValue !== null) {
            return (
                <fieldset
                    key={fieldName}
                    className="relative border border-gray-300 p-3 rounded mt-3 space-y-2"
                >
                    <legend className="text-sm font-medium">{labelize(key)}</legend>

                    {Object.entries(shapeValue).map(([childKey, childValue]) =>
                        renderField(childKey, childValue, fullPath)
                    )}
                </fieldset>
            );
        }

        if (typeof shapeValue === 'boolean') {
            return (
                <label key={fieldName} className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={!!readEntityPath(fullPath)}
                        onChange={(e) => handleInputChange(fullPath, e)}
                        disabled={disabled}
                    />
                    {labelize(key)}
                </label>
            );
        }

        const lowerKey = key.toLowerCase();

        if (
            lowerKey.includes('date') ||
            lowerKey.includes('dob') ||
            (typeof shapeValue === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(shapeValue))
        ) {
            return (
                <label key={fieldName} className="block">
                    <span className="font-medium">{labelize(key)}</span>
                    <input
                        type="date"
                        value={String(readEntityPath(fullPath) ?? '')}
                        onChange={(e) => handleInputChange(fullPath, e)}
                        className="w-full border rounded p-1 mt-1"
                        disabled={disabled}
                    />
                </label>
            );
        }

        if (typeof shapeValue === 'number') {
            return (
                <label key={fieldName} className="block">
                    <span className="font-medium">{labelize(key)}</span>
                    <input
                        type="number"
                        value={String(readEntityPath(fullPath) ?? '')}
                        onChange={(e) => handleInputChange(fullPath, e)}
                        className="w-full border rounded p-1 mt-1"
                        disabled={disabled}
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
                        value={String(readEntityPath(fullPath) ?? '')}
                        onChange={(e) => {
                            const selectedValue = e.target.value || null;
                            hier.onChange(key, selectedValue);
                            setEntityPath(fullPath, selectedValue);
                        }}
                        className="w-full border rounded p-1 mt-1"
                        disabled={h?.isLoading || disabled}
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
                    value={String(readEntityPath(fullPath) ?? '')}
                    onChange={(e) => handleInputChange(fullPath, e)}
                    className="w-full border rounded p-1 mt-1"
                    disabled={disabled}
                />
            </label>
        );
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();

        const savePayload = normalizeEntityForSave(entity, metadata);

        if (onSavedAction) {
            await onSavedAction(savePayload);
            return;
        }

        await save(savePayload);
    }

    if (metadataLoading || entityLoading) {
        return <div>Loading {entityName}...</div>;
    }

    if (!metadata) {
        return <div>No metadata found for {entityName}.</div>;
    }

    return (
        <form onSubmit={handleSubmit} className="grid gap-4">
            <Toaster position="bottom-center" richColors />

            <div>
                <h2 className="text-lg font-bold">
                    {isNewEntity ? 'Create' : 'Edit'} {entityName}
                </h2>

                {entityError && (
                    <p className="text-sm text-red-600 mt-1">
                        {entityError}
                    </p>
                )}
            </div>

            {Object.entries(renderShape).map(([key, value]) => {
                if (key === 'entity_json') return null;
                return renderField(key, value);
            })}

            <div className="flex gap-3">
                <button
                    type="submit"
                    className={`mt-4 px-4 py-2 rounded text-white ${
                        saving
                            ? 'bg-gray-400 cursor-wait'
                            : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    disabled={saving}
                >
                    {saving
                        ? 'Saving...'
                        : isNewEntity
                          ? `Create ${entityName}`
                          : `Save ${entityName}`}
                </button>

                {onCancelAction && (
                    <button
                        type="button"
                        onClick={onCancelAction}
                        className="mt-4 px-4 py-2 rounded border"
                        disabled={saving}
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
}