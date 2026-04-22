"use client";

import { useParams } from "next/navigation";
import EntityEditor from "@/components/EntityEditor";
import { Suspense} from "react";

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
    const params = useParams() as { entityName?: string };

    const raw = params.entityName ?? "";
    const entityName = raw === "new" ? "" : raw;

    return (
        <div className="p-6">
             <EntityEditor entityName={entityName} />
        </div>
    );
}


