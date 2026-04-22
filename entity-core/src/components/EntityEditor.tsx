"use client";
import { useEntityEditor } from "@/hooks/useEntityEditor";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

const router = useRouter();

export default function EntityEditor({ entityName: initialName }: { entityName?: string }) {
    const [entityName, setEntityName] = useState(initialName ?? "");
    const { entity, loadEntity, saveEntity, isLoading, error } = useEntityEditor(entityName);
    const [jsonStr, setJsonStr] = useState("");

    // Load when entityName changes
    useEffect(() => {
        debugger;
        if (entityName) {
            loadEntity();
        }
    }, [entityName]);

    // Reflect loaded entity into editor
    useEffect(() => {
        if (entity) {
            setJsonStr(JSON.stringify(entity.entity_json, null, 2));
        }
    }, [entity]);

    const onSave = async () => {
        try {
            const parsed = JSON.parse(jsonStr);

            const saved = await saveEntity(parsed);

            // 👇 THIS is the magic
            const finalName = saved.entity || entityName;

            router.push(`/entities/${finalName}`);

        } catch {
            alert("⚠️ Invalid JSON or save failed.");
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">
                Entity Editor — <span className="text-blue-600">{entityName || "New Entity"}</span>
            </h2>

            <div>
                <label className="block font-medium mb-2">Entity Name</label>
                <input
                    type="text"
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    className="border px-3 py-2 rounded w-full"
                />
            </div>

            {error && <div className="text-red-500 text-sm">{error}</div>}

            <textarea
                value={jsonStr}
                onChange={(e) => setJsonStr(e.target.value)}
                rows={20}
                className="w-full font-mono text-sm border rounded-lg p-3"
            />

            <button
                onClick={onSave}
                disabled={isLoading}
                className="px-3 py-2 bg-blue-600 text-white rounded-md"
            >
                Save Entity
            </button>
        </div>
    );
}