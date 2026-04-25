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
    //const [inputName, setInputName] = useState(entityNameParam || "");
    const [entityName, setEntityName] = useState(entityNameParam || "");
    const [jsonStr, setJsonStr] = useState("");
    const { isAuthenticated, loading: authLoading} = useAuth();
    const { entity, loadEntity, saveEntity, isLoading, error } = useEntity();



    // ✅ Load entity when ready
    useEffect(() => {
        if (!authLoading && isAuthenticated && entityNameParam !== "new") {
            loadEntity(entityName);
        }
    }, [authLoading, isAuthenticated, entityName]);

    // ✅ Populate editor
   useEffect(() => {
    if (!entity) return;

    if (!entity.entity_json) {
        setJsonStr("{}");
        return;
    }

    try {
        const safe =
            typeof entity.entity_json === "string"
                ? JSON.parse(entity.entity_json)
                : entity.entity_json;

        setJsonStr(JSON.stringify(safe, null, 2));
    } catch (e) {
        console.error("Failed to normalize entity_json:", e);
        setJsonStr("{}");
    }
}, [entity]);

    const onSave = async () => {
    console.log("🔥 SAVE CLICKED");
    console.log("RAW jsonStr:", jsonStr);

    try {
        const parsed = JSON.parse(jsonStr);
        console.log("✅ PARSED OK:", parsed);

        await saveEntity(entityName, parsed);

    } catch (e) {
        console.error("❌ FULL ERROR:", e);
        alert("JSON PARSE FAILED — check console");
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

