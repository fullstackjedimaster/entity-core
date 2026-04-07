"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { apiFetchRaw } from "@/lib/api";

export default function EntitiesHome() {
    const [entities, setEntities] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState<string | null>(null);

    useEffect(() => {
        (async () => {
            try {
                const res = await apiFetchRaw("/entities");
                const json = await res.json();
                setEntities(json.entities || []);
            } catch (e: any) {
                setErr(e.message);
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    if (loading) return <div className="p-4">Loading entities…</div>;
    if (err) return <div className="p-4 text-red-600">{err}</div>;

    return (
        <main className="p-6 space-y-4">
            <h1 className="text-xl font-bold">Entities</h1>
            <ul className="space-y-2">
                {entities.map((e) => (
                    <li key={e}>
                        <Link href={`/${e}`} className="text-blue-600 underline">
                            {e}
                        </Link>
                    </li>
                ))}
            </ul>
        </main>
    );
}
