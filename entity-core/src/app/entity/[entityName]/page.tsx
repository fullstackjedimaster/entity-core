"use client";

import { useParams, useRouter } from "next/navigation";
import { useEntity } from "@/hooks/useEntity";
import { Suspense, useState, useEffect} from "react";
import { useAuth } from "@/contexts/AuthContext";

export default function EntityDetailPage() {
    return (
        <Suspense
            fallback={
                <main className="p-6 max-w-md mx-auto">
                    <p className="text-gray-700">Loading entity…</p>
                </main>
            }
        >
            <EntityInner />
        </Suspense>
    );
}

function EntityInner() {
    const router = useRouter();
    const params = useParams();

    const entityNameParam = params?.entityName as string;
    const [entityName, setEntityName] = useState(entityNameParam || "");
    const [jsonStr, setJsonStr] = useState("");
    const { isAuthenticated, loading: authLoading, } = useAuth();
    const { entity, loadEntity, saveEntity, isLoading, error } = useEntity(entityName);

    // ✅ Sync URL param → state
    useEffect(() => {
        if (entityNameParam) {
            setEntityName(entityNameParam);
        }
    }, [entityNameParam]);

    // ✅ Load entity when ready
    useEffect(() => {
        if (!authLoading && isAuthenticated && entityName !== "new") {
            loadEntity();
        }
    }, [authLoading, isAuthenticated, entityName]);

    // ✅ Populate editor
    useEffect(() => {
        if (entity) {
            setJsonStr(JSON.stringify(entity.entity_json, null, 2));
        }
    }, [entity]);

    const onSave = async () => {
        try {
            const parsed = JSON.parse(jsonStr);
            const saved = await saveEntity(parsed);

            const finalName = saved.entity || entityName;
            router.push(`/entities/${finalName}`);

        } catch {
            alert("⚠️ Invalid JSON or save failed.");
        }
    };

    // ✅ AUTH GUARD
    if (authLoading) {
        return <p className="p-6">Checking authentication...</p>;
    }

    if (!isAuthenticated) {
        return <p className="p-6 text-red-500">You must be logged in.</p>;
    }

    return (
        <div className="space-y-4">
            <h2 className="text-xl font-semibold">
                Entity — <span className="text-blue-600">{entityName || "New Entity"}</span>
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
                {isLoading ? "Saving..." : "Save Entity"}
            </button>
        </div>
    );
}

