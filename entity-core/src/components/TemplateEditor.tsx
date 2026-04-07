"use client";
import { useTemplateEditor } from "@/hooks/useTemplateEditor";
import { useState, useEffect } from "react";

export default function TemplateEditor({ entity }: { entity: string }) {
    const { template, loadTemplate, saveTemplate, isLoading, error } = useTemplateEditor(entity);
    const [jsonStr, setJsonStr] = useState("");

    // Reflect loaded template into editor text
    useEffect(() => {
        if (template) {
            setJsonStr(JSON.stringify(template, null, 2));
        }
    }, [template]);

    const onLoad = async () => {
        await loadTemplate();
    };

    const onSave = async () => {
        try {
            const parsed = JSON.parse(jsonStr);
            await saveTemplate(parsed);
            alert("✅ Template saved successfully.");
        } catch (err) {
            alert("⚠️ Invalid JSON or save failed.");
        }
    };

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold text-gray-800 dark:text-gray-100">
                Template Editor — <span className="text-blue-600">{entity}</span>
            </h2>

            <div className="flex gap-2">
                <button
                    onClick={onLoad}
                    disabled={isLoading}
                    className="px-3 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-md"
                >
                    {isLoading ? "Loading..." : "Load Template"}
                </button>

                <button
                    onClick={onSave}
                    className="px-3 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-md"
                >
                    Save Template
                </button>
            </div>

            {error && <div className="text-red-500 text-sm">{error}</div>}

            <textarea
                value={jsonStr}
                onChange={(e) => setJsonStr(e.target.value)}
                rows={20}
                spellCheck={false}
                className="w-full font-mono text-sm border border-gray-300 dark:border-gray-700 rounded-lg p-3 bg-white dark:bg-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-400 focus:outline-none"
            />
        </div>
    );
}
