"use client";
import { useEntityEditor } from "@/hooks/useEntityEditor";
import { useState, useEffect } from "react";


export default function EntityEditor({ entity }: { entity: string }) {
    const { entity, loadEntity, saveEntity, isLoading, error } = useEntityEditor(entity);
    const [entityName, setEntityName] = useState('');
    const [jsonStr, setJsonStr] = useState("");

//     // Reflect loaded entity into editor text
    useEffect(() => {
        if (entity) {
            setJsonStr(JSON.stringify(entity, null, 2));
        }
    }, [entity]);

//     const onLoad = async () => {
//         await loadEntity();
//     };

    const onSave = async () => {
        try {
            const parsed = JSON.parse(jsonStr);
            await saveEntity(parsed);
            alert("✅ Entity saved successfully.");
        } catch (err) {
            alert("⚠️ Invalid JSON or save failed.");
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Entity Editor — <span className="text-blue-600">{entity}</span>
            </h2>
           <div>
                <label className="block font-medium mb-2">Entity Name</label>
                <input
                    type="text"
                    value={entityName}
                    onChange={(e) => setEntityName(e.target.value)}
                    className="border px-3 py-2 rounded w-full"
                    placeholder="e.g., employee"
                />
            </div>

            {error && <div className="text-red-500 text-sm">{error}</div>}

            <textarea
                value={jsonStr}
                onChange={(e) => setJsonStr(e.target.value)}
                rows={20}
                spellCheck={false}
                className="w-full font-mono text-sm border border-gray-300 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />

             <div className="flex gap-2">


                <button
                    onClick={onSave}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                >
                    Save Entity
                </button>
            </div>

        </div>
    );
}
