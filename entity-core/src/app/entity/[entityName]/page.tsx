"use client";

import { useParams } from "next/navigation";
import EntityEditor from "@/components/EntityEditor";

export default function EntityEditPage() {
    const params = useParams() as { entityName?: string };

    const raw = params.entityName ?? "";
    const entityName = raw === "new" ? "" : raw;

    return (
        <div className="p-6">
             <EntityEditor entityName={entityName} />
        </div>
    );
}


