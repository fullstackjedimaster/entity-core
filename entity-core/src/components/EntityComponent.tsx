"use client";
import React, { useState } from "react";
import { useFormMetadata } from "@/hooks/useFormMetadata";
import { useSaveEntity } from "@/hooks/useSaveEntity";
import { useHierarchicalOptions } from "@/hooks/useHierarchicalOptions";
import { useAuthInfo } from "@/hooks/useAuthInfo";
import { Toaster } from "sonner";

type FormValues = Record<string, any>;

type EntityComponentProps = {
    entityName: string;
    initialValues?: Record<string, any>;
};

export default function EntityComponent({ entityName, initialValues }: EntityComponentProps) {
    const { metadata, isLoading } = useFormMetadata(entityName);
    const { entity_schema } = useAuthInfo();
    const [addButtonEnabled, setAddButtonEnabled] = useState<Record<string, boolean>>({});
    const [formValues, setFormValues] = useState<FormValues>(initialValues ?? {});

    React.useEffect(() => {
        if (initialValues) {
            setFormValues(initialValues);
        }
    }, [initialValues]);


    const { save, loading } = useSaveEntity({
        entityName: entityName,
        primaryKey: metadata?.primaryKey ?? "id",
    });

    const hierarchyFields = metadata?.fields
        .map((f) => f.name)
        .filter((n) => /_hier\d+$/.test(n)) ?? [];

    const hier = useHierarchicalOptions(
        entityName,
        hierarchyFields,
        "id",
        "name"
    );

    if (isLoading) return <div>Loading form schema…</div>;
    if (!metadata) return <div>No metadata found.</div>;

    const setNestedValue = (path: string[], value: any) => {
        setFormValues((prev) => {
            const updated = { ...prev };
            let ref = updated;
            for (let i = 0; i < path.length - 1; i++) {
                ref[path[i]] = { ...(ref[path[i]] || {}) };
                ref = ref[path[i]];
            }
            ref[path.at(-1)!] = value;
            return updated;
        });
    };

    const getNestedValue = (path: string[]) => {
        return path.reduce((acc, key) => (acc && acc[key] !== undefined ? acc[key] : ""), formValues);
    };

    const handleInputChange = (
        path: string[],
        e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>
    ) => {
        const target = e.target;
        const value =
            target instanceof HTMLInputElement && target.type === "checkbox"
                ? target.checked
                : target.value;
        setNestedValue(path, value);
    };

    const handleAddRow = (path: string[]) => {
        const current = (getNestedValue(path) as any[]) || [];
        setNestedValue(path, [...current, {}]);
        setAddButtonEnabled((prev) => ({ ...prev, [path.join(".")]: false }));
    };

    const handleDeleteRow = (path: string[], index: number) => {
        const current = [...((getNestedValue(path) as any[]) || [])];
        current.splice(index, 1);
        setNestedValue(path, current);
    };

    const handleBlurRow = (row: Record<string, any>, path: string[]) => {
        const allFilled = Object.values(row).every((val) => val !== "");
        setAddButtonEnabled((prev) => ({ ...prev, [path.join(".")]: allFilled }));
    };

    const renderField = (key: string, value: any, path: string[] = []) => {
        const fullPath = [...path, key];
        const fieldName = fullPath.join(".");

        if (Array.isArray(value)) {
            const rows = getNestedValue(fullPath) || [{}];
            return (
                <div key={fieldName}>
                    <h3 className="font-bold">{key.replace(/_/g, " ").toUpperCase()}</h3>
                    <table className="table-auto border border-gray-300 mb-2 w-full text-sm">
                        <thead>
                        <tr>
                            {Object.keys(value[0] || {}).map((col) => (
                                <th key={col} className="px-2 py-1 border border-gray-200">{col}</th>
                            ))}
                            <th>Actions</th>
                        </tr>
                        </thead>
                        <tbody>
                        {rows.map((row: any, index: number) => (
                            <tr key={index}>
                                {Object.keys(value[0] || {}).map((col) => (
                                    <td key={col} className="px-2 py-1 border border-gray-200">
                                        <input
                                            type="text"
                                            className="w-full border rounded p-1"
                                            value={row[col] || ""}
                                            onChange={(e) =>
                                                setNestedValue([...fullPath, index.toString(), col], e.target.value)
                                            }
                                            onBlur={() => handleBlurRow(row, fullPath)}
                                        />
                                    </td>
                                ))}
                                <td className="px-2 py-1 text-center">
                                    {rows.length > 1 && (
                                        <button type="button" className="text-red-500" onClick={() => handleDeleteRow(fullPath, index)}>
                                            −
                                        </button>
                                    )}
                                </td>
                            </tr>
                        ))}
                        </tbody>
                    </table>
                    <button
                        type="button"
                        className="text-green-600 text-sm"
                        onClick={() => handleAddRow(fullPath)}
                        disabled={!addButtonEnabled[fieldName]}
                    >
                        + Add Row
                    </button>
                </div>
            );
        }

        if (typeof value === "object" && value !== null) {
            return (
                <fieldset key={fieldName} className="border border-gray-300 p-3 rounded mt-3 space-y-2">
                    <legend className="text-sm font-medium">{key.replace(/_/g, " ")}</legend>
                    {Object.entries(value).map(([k, v]) => renderField(k, v, fullPath))}
                </fieldset>
            );
        }

        if (typeof value === "boolean") {
            return (
                <label key={fieldName} className="flex items-center gap-2">
                    <input
                        type="checkbox"
                        checked={!!getNestedValue(fullPath)}
                        onChange={(e) => handleInputChange(fullPath, e)}
                        disabled={loading}
                    />
                    {key.replace(/_/g, " ")}
                </label>
            );
        }

        if (
            key.toLowerCase().includes("date") ||
            key.toLowerCase().includes("dob") ||
            typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)
        ) {
            return (
                <label key={fieldName} className="block">
                    <span className="font-medium">{key.replace(/_/g, " ")}</span>
                    <input
                        type="date"
                        value={String(getNestedValue(fullPath) ?? "")}
                        onChange={(e) => handleInputChange(fullPath, e)}
                        className="w-full border rounded p-1 mt-1"
                    />
                </label>
            );
        }

        if (typeof value === "number") {
            return (
                <label key={fieldName} className="block">
                    <span className="font-medium">{key.replace(/_/g, " ")}</span>
                    <input
                        type="number"
                        value={String(getNestedValue(fullPath) ?? "")}
                        onChange={(e) => handleInputChange(fullPath, e)}
                        className="w-full border rounded p-1 mt-1"
                    />
                </label>
            );
        }

        if (hierarchyFields.includes(key)) {
            const h = hier.hooks.find((h) => h.field === key);
            return (
                <label key={fieldName} className="block">
                    <span className="font-medium">{key.replace(/_/g, " ")}</span>
                    <select
                        name={key}
                        value={formValues[key] ?? ""}
                        onChange={(e) => hier.onChange(key, e.target.value || null)}
                        className="w-full border rounded p-1 mt-1"
                        disabled={h?.isLoading || loading}
                    >
                        <option value="">Select...</option>
                        {h?.options?.map((opt) => (
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
                <span className="font-medium">{key.replace(/_/g, " ")}</span>
                <input
                    type="text"
                    value={String(getNestedValue(fullPath) ?? "")}
                    onChange={(e) => handleInputChange(fullPath, e)}
                    className="w-full border rounded p-1 mt-1"
                />
            </label>
        );
    };

    async function handleSubmit(e: React.FormEvent) {
        e.preventDefault();
        const fullData = entity_schema ? { ...formValues, __entity_schema: entity_schema } : formValues;
        await save(fullData);
    }

    return (
        <form onSubmit={handleSubmit} className="grid gap-4">
            <Toaster position="bottom-center" richColors />
            <h2 className="text-lg font-bold">New {entityName}</h2>

            {formValues._template
                ? Object.entries(formValues._template).map(([k, v]) => renderField(k, v))
                : metadata.fields.map((f) =>
                    renderField(f.name, f.type === "boolean" ? false : "")
                )}

            <button
                type="submit"
                className={`mt-4 px-4 py-2 rounded text-white ${
                    loading ? "bg-gray-400 cursor-wait" : "bg-blue-600 hover:bg-blue-700"
                }`}
                disabled={loading}
            >
                {loading ? "Saving..." : "Save"}
            </button>
        </form>
    );
}
