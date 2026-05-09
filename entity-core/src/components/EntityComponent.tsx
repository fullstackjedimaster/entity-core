'use client';

import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Toaster } from 'sonner';

import { useFormMetadata } from '@/hooks/useFormMetadata';
import { useHierarchicalOptions } from '@/hooks/useHierarchicalOptions';
import { useEntity } from '@/hooks/useEntity';
import { useEntityData } from '@/hooks/useEntityData';
import { ZERO_UUID } from '@/lib/apiCrud';

type Entity = Record<string, any>;

type EntityComponentProps = {
    entityName: string;
    id?: string;
    initialValues?: Entity;
    onSavedAction?: (savedEntity: Entity) => Promise<void> | void;
    onCancelAction?: () => void;
};

function labelize(value: string): string {
    return value.replace(/_/g, ' ');
}

function cloneValue<T>(value: T): T {
    if (value === undefined || value === null) return value;
    return JSON.parse(JSON.stringify(value));
}

function hierarchyLevel(field: string): number {
    const match = field.match(/_hier(\d+)$/);
    return match ? Number(match[1]) : Number.MAX_SAFE_INTEGER;
}

function normalizeLoadedEntity(payload: any): Entity {
    if (!payload) return {};

    if (payload.entity && typeof payload.entity === 'object') return cloneValue(payload.entity);
    if (payload.result?.entity && typeof payload.result.entity === 'object') return cloneValue(payload.result.entity);
    if (payload.result?.data && typeof payload.result.data === 'object') return cloneValue(payload.result.data);
    if (payload.data && typeof payload.data === 'object') return cloneValue(payload.data);
    if (payload.items && typeof payload.items === 'object') return cloneValue(payload.items);
    if (payload.result && typeof payload.result === 'object') return cloneValue(payload.result);
    if (typeof payload === 'object') return cloneValue(payload);

    return {};
}

function extractEntityJsonFromDefinition(definition: any, entityName: string): Entity | null {
    const raw =
        definition?.entity_json ??
        definition?.entityJson ??
        definition?.entity?.entity_json ??
        definition?.entity?.entityJson ??
        definition?.data?.entity_json ??
        definition?.data?.entityJson ??
        definition?.result?.entity_json ??
        definition?.result?.entityJson ??
        definition?.items?.entity_json ??
        definition?.items?.entityJson ??
        null;

    if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;

    return cloneValue(
        raw[entityName] && typeof raw[entityName] === 'object'
            ? raw[entityName]
            : raw
    );
}

function defaultValueFromShape(value: any): any {
    if (Array.isArray(value)) return [];

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

function buildEntityFromShape(shape: Entity | null, metadata: any): Entity {
    if (!shape || Object.keys(shape).length === 0) {
        return buildEntityFromMetadata(metadata);
    }

    const entity: Entity = {};

    for (const [key, value] of Object.entries(shape)) {
        entity[key] = defaultValueFromShape(value);
    }

    return entity;
}

function mergeEntityValuesIntoShape(shape: any, values: any): any {
    if (Array.isArray(shape)) {
        const templateRow =
            shape.length > 0 && typeof shape[0] === 'object' && shape[0] !== null
                ? shape[0]
                : {};

        if (!Array.isArray(values)) return [];

        return values.map((row) => {
            if (row && typeof row === 'object' && !Array.isArray(row)) {
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

function normalizeEntityForSave(entityValue: Entity, metadata: any): Entity {
    const normalized = cloneValue(entityValue) || {};

    for (const field of metadata?.fields ?? []) {
        const type = String(field?.type ?? '').toLowerCase();

        if ((type === 'json' || type === 'jsonb') && normalized[field.name] === '') {
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

    const {
        loadEntity: loadEntityDefinition,
        isLoading: entityDefinitionLoading,
        error: entityDefinitionError,
    } = useEntity();

    const {
        loadEntityData,
        saveEntityData,
        isLoading: entityDataLoading,
        error: entityDataError,
    } = useEntityData();

    const [entity, setEntity] = useState<Entity>({});
    const [formShape, setFormShape] = useState<Entity>({});
    const [entityLoading, setEntityLoading] = useState(true);
    const [entityError, setEntityError] = useState<string | null>(null);
    const [addButtonEnabled, setAddButtonEnabled] = useState<Record<string, boolean>>({});

    const hierarchyFields = useMemo(() => {
        return (
            metadata?.fields
                ?.map((field: any) => field.name)
                .filter((name: string) => /_hier\d+$/.test(name))
                .sort((a: string, b: string) => hierarchyLevel(a) - hierarchyLevel(b)) ?? []
        );
    }, [metadata]);

    const hier = useHierarchicalOptions(entityName, hierarchyFields);

    useEffect(() => {
        let cancelled = false;

        async function runLoadEntity() {
            if (!metadata || !entityName) return;

            setEntityLoading(true);
            setEntityError(null);

            try {
                const definitionPayload = await loadEntityDefinition(entityName);
                if (cancelled) return;

                const definition = normalizeLoadedEntity(definitionPayload);
                const shape = extractEntityJsonFromDefinition(definition, entityName);

                const resolvedShape =
                    shape && Object.keys(shape).length > 0
                        ? shape
                        : buildEntityFromMetadata(metadata);

                setFormShape(resolvedShape);

                let resolvedEntity: Entity;

                if (initialValues) {
                    resolvedEntity = shape
                        ? mergeEntityValuesIntoShape(shape, initialValues)
                        : cloneValue(initialValues);
                } else if (isNewEntity) {
                    resolvedEntity = buildEntityFromShape(shape, metadata);
                } else {
                    const dataPayload = await loadEntityData(itemId, entityName);
                    if (cancelled) return;

                    const loadedEntity = normalizeLoadedEntity(dataPayload);

                    resolvedEntity =
                        Object.keys(loadedEntity).length > 0
                            ? shape
                                ? mergeEntityValuesIntoShape(shape, loadedEntity)
                                : loadedEntity
                            : buildEntityFromShape(shape, metadata);
                }

                setEntity(resolvedEntity);
                hier.setSelectionsFromEntity(resolvedEntity);
            } catch (err) {
                if (cancelled) return;

                console.error(`Error loading ${entityName}:`, err);

                const message =
                    err instanceof Error ? err.message : 'Unable to load entity';

                setEntityError(message);

                const fallbackShape = buildEntityFromMetadata(metadata);
                setFormShape(fallbackShape);
                setEntity(fallbackShape);
                hier.setSelectionsFromEntity(fallbackShape);
            } finally {
                if (!cancelled) {
                    setEntityLoading(false);
                }
            }
        }

        void runLoadEntity();

        return () => {
            cancelled = true;
        };
    }, [
        metadata,
        entityName,
        itemId,
        isNewEntity,
        initialValues,
        loadEntityDefinition,
        loadEntityData,
        hier.setSelectionsFromEntity,
    ]);

    const setEntityPath = useCallback((path: string[], value: any) => {
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
    }, []);

    const readEntityPath = useCallback(
        (path: string[]) => {
            return path.reduce<any>((acc, key) => {
                if (acc === undefined || acc === null) return '';
                return acc[key] !== undefined ? acc[key] : '';
            }, entity);
        },
        [entity]
    );

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

    const handleHierarchyChange = (path: string[], key: string, value: string | null) => {
        hier.onChange(key, value);

        setEntity((prev) => {
            const updated = cloneValue(prev) || {};
            let ref = updated;

            for (let i = 0; i < path.length - 1; i++) {
                const pathKey = path[i];
                if (ref[pathKey] === undefined || ref[pathKey] === null) {
                    ref[pathKey] = {};
                }
                ref = ref[pathKey];
            }

            ref[path[path.length - 1]] = value ?? '';

            const index = hierarchyFields.indexOf(key);
            for (let i = index + 1; i < hierarchyFields.length; i++) {
                updated[hierarchyFields[i]] = '';
            }

            return updated;
        });
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
        const disabled =
            entityLoading ||
            entityDefinitionLoading ||
            entityDataLoading;

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
            const options = hier.optionsByField[key] ?? [];
            const hierarchyLoading = hier.loadingByField[key] ?? false;
            const hierarchyEnabled = hier.isFieldEnabled(key);
            const hierarchyError = hier.errorByField[key];

            return (
                <label key={fieldName} className="block">
                    <span className="font-medium">{labelize(key)}</span>
                    <select
                        name={key}
                        value={String(readEntityPath(fullPath) ?? '')}
                        onChange={(e) => {
                            const selectedValue = e.target.value || null;
                            handleHierarchyChange(fullPath, key, selectedValue);
                        }}
                        className="w-full border rounded p-1 mt-1"
                        disabled={disabled || hierarchyLoading || !hierarchyEnabled}
                    >
                        <option value="">
                            {hierarchyEnabled ? 'Select...' : 'Select previous level first...'}
                        </option>

                        {options.map((opt) => (
                            <option key={String(opt.value)} value={String(opt.value)}>
                                {opt.label}
                            </option>
                        ))}
                    </select>

                    {hierarchyError && (
                        <p className="text-xs text-red-600 mt-1">
                            Failed to load options.
                        </p>
                    )}
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

        await saveEntityData(isNewEntity ? null : itemId, entityName, savePayload);
    }

    const displayedError =
        entityError ||
        entityDefinitionError ||
        entityDataError;

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

                {displayedError && (
                    <p className="text-sm text-red-600 mt-1">
                        {displayedError}
                    </p>
                )}
            </div>

            {Object.entries(formShape).map(([key, value]) => {
                if (key === 'entity_json') return null;
                return renderField(key, value);
            })}

            <div className="flex gap-3">
                <button
                    type="submit"
                    className={`mt-4 px-4 py-2 rounded text-white ${
                        entityDataLoading
                            ? 'bg-gray-400 cursor-wait'
                            : 'bg-blue-600 hover:bg-blue-700'
                    }`}
                    disabled={entityDataLoading}
                >
                    {entityDataLoading
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
                        disabled={entityDataLoading}
                    >
                        Cancel
                    </button>
                )}
            </div>
        </form>
    );
}