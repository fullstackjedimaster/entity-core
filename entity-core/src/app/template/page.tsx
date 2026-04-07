'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

interface TemplateInfo {
    entity_name: string;
}

export default function TemplateIndexPage() {
    const [templates, setTemplates] = useState<TemplateInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        async function fetchTemplates() {
            try {
                const resp = await fetch('/api/template');
                if (!resp.ok) throw new Error(`Server responded ${resp.status}`);
                const data = await resp.json();
                setTemplates(data);
            } catch (err: any) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        }
        fetchTemplates();
    }, []);

    return (
        <div className="p-6 max-w-2xl mx-auto space-y-6">
            <h1 className="text-2xl font-semibold">Templates</h1>

            <div>
                <Link
                    href="/template/new"
                    className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
                >
                    + Create New Template
                </Link>
            </div>

            {loading && <p>Loading…</p>}
            {error && <p className="text-red-600">Error: {error}</p>}

            {!loading && !error && templates.length === 0 && (
                <p className="text-gray-600">No templates found.</p>
            )}

            <ul className="border divide-y rounded">
                {templates.map((tpl) => (
                    <li key={tpl.entity_name} className="p-4 flex justify-between">
                        <span>{tpl.entity_name}</span>
                        <Link
                            href={`/template/${tpl.entity_name}`}
                            className="text-blue-600 hover:underline"
                        >
                            View / Edit →
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
