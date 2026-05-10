'use client';

import { useMemo, useState } from 'react';

type FieldType =
    | 'text'
    | 'number'
    | 'boolean'
    | 'date'
    | 'datetime'
    | 'email'
    | 'textarea'
    | 'json'
    | 'select';

type TemplateField = {
    id: string;
    name: string;
    label: string;
    type: FieldType;
    required: boolean;
    optionsText: string;
};

type EntityTemplateBuilderProps = {
    entityName: string;
    initialFields?: TemplateField[];
    onChange?: (template: Record<string, unknown>) => void;
};

const FIELD_TYPES: FieldType[] = [
    'text',
    'number',
    'boolean',
    'date',
    'datetime',
    'email',
    'textarea',
    'json',
    'select',
];

function createId() {
    return crypto.randomUUID?.() ?? Math.random().toString(36).slice(2);
}

function createEmptyField(): TemplateField {
    return {
        id: createId(),
        name: '',
        label: '',
        type: 'text',
        required: false,
        optionsText: '',
    };
}

function normalizeFieldName(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/\s+/g, '_')
        .replace(/[^a-z0-9_]/g, '');
}

function buildDefaultValue(field: TemplateField) {
    switch (field.type) {
        case 'number':
            return 0;
        case 'boolean':
            return false;
        case 'json':
            return {};
        case 'select':
            return '';
        default:
            return '';
    }
}

function buildTemplate(entityName: string, fields: TemplateField[]) {
    const entityKey = normalizeFieldName(entityName || 'new_entity');

    const payload: Record<string, unknown> = {};

    for (const field of fields) {
        const key = normalizeFieldName(field.name);

        if (!key) continue;

        const fieldConfig: Record<string, unknown> = {
            label: field.label || field.name,
            type: field.type,
            required: field.required,
            default: buildDefaultValue(field),
        };

        if (field.type === 'select') {
            fieldConfig.widget = 'select';
            fieldConfig.options = field.optionsText
                .split(',')
                .map((option) => option.trim())
                .filter(Boolean);
        }

        payload[key] = fieldConfig;
    }

    return {
        [entityKey]: payload,
    };
}

export default function EntityTemplateBuilder({
    entityName,
    initialFields,
    onChange,
}: EntityTemplateBuilderProps) {
    const [fields, setFields] = useState<TemplateField[]>(
        initialFields?.length ? initialFields : [createEmptyField()]
    );

    const template = useMemo(() => {
        return buildTemplate(entityName, fields);
    }, [entityName, fields]);

    function updateField(
        id: string,
        patch: Partial<TemplateField>
    ) {
        const nextFields = fields.map((field) =>
            field.id === id ? { ...field, ...patch } : field
        );

        setFields(nextFields);
        onChange?.(buildTemplate(entityName, nextFields));
    }

    function addField() {
        const nextFields = [...fields, createEmptyField()];
        setFields(nextFields);
        onChange?.(buildTemplate(entityName, nextFields));
    }

    function removeField(id: string) {
        const nextFields =
            fields.length === 1
                ? [createEmptyField()]
                : fields.filter((field) => field.id !== id);

        setFields(nextFields);
        onChange?.(buildTemplate(entityName, nextFields));
    }

    return (
        <section className="rounded-lg border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-4 flex items-center justify-between">
                <div>
                    <h2 className="text-lg font-semibold text-gray-900">
                        Entity Template Builder
                    </h2>
                    <p className="text-sm text-gray-500">
                        Add fields, choose types, and generate the JSON template.
                    </p>
                </div>

                <button
                    type="button"
                    onClick={addField}
                    className="rounded-md bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                    Add Field
                </button>
            </div>

            <div className="space-y-4">
                {fields.map((field) => (
                    <div
                        key={field.id}
                        className="rounded-md border border-gray-200 bg-gray-50 p-3"
                    >
                        <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
                            <label className="block">
                                <span className="text-xs font-medium text-gray-600">
                                    Field Name
                                </span>
                                <input
                                    value={field.name}
                                    onChange={(event) =>
                                        updateField(field.id, {
                                            name: event.target.value,
                                        })
                                    }
                                    placeholder="first_name"
                                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                                />
                            </label>

                            <label className="block">
                                <span className="text-xs font-medium text-gray-600">
                                    Label
                                </span>
                                <input
                                    value={field.label}
                                    onChange={(event) =>
                                        updateField(field.id, {
                                            label: event.target.value,
                                        })
                                    }
                                    placeholder="First Name"
                                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                                />
                            </label>

                            <label className="block">
                                <span className="text-xs font-medium text-gray-600">
                                    Type
                                </span>
                                <select
                                    value={field.type}
                                    onChange={(event) =>
                                        updateField(field.id, {
                                            type: event.target.value as FieldType,
                                        })
                                    }
                                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                                >
                                    {FIELD_TYPES.map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                            </label>

                            <label className="flex items-end gap-2 pb-2">
                                <input
                                    type="checkbox"
                                    checked={field.required}
                                    onChange={(event) =>
                                        updateField(field.id, {
                                            required: event.target.checked,
                                        })
                                    }
                                />
                                <span className="text-sm text-gray-700">
                                    Required
                                </span>
                            </label>

                            <div className="flex items-end">
                                <button
                                    type="button"
                                    onClick={() => removeField(field.id)}
                                    className="w-full rounded-md border border-red-300 px-3 py-2 text-sm font-medium text-red-700 hover:bg-red-50"
                                >
                                    Remove
                                </button>
                            </div>
                        </div>

                        {field.type === 'select' && (
                            <label className="mt-3 block">
                                <span className="text-xs font-medium text-gray-600">
                                    Select Options
                                </span>
                                <input
                                    value={field.optionsText}
                                    onChange={(event) =>
                                        updateField(field.id, {
                                            optionsText: event.target.value,
                                        })
                                    }
                                    placeholder="Active, Inactive, Pending"
                                    className="mt-1 w-full rounded-md border border-gray-300 px-3 py-2 text-sm"
                                />
                                <span className="mt-1 block text-xs text-gray-500">
                                    Enter comma-separated values.
                                </span>
                            </label>
                        )}
                    </div>
                ))}
            </div>

            <div className="mt-6">
                <h3 className="mb-2 text-sm font-semibold text-gray-700">
                    Generated Template
                </h3>

                <pre className="max-h-96 overflow-auto rounded-md bg-gray-950 p-4 text-xs text-gray-100">
                    {JSON.stringify(template, null, 2)}
                </pre>
            </div>
        </section>
    );
}