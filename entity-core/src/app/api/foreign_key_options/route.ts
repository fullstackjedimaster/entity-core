// entity-core/src/app/api/foreign-key-options/route.ts

import { NextRequest, NextResponse } from 'next/server';

const ENTITY_CORE_API_URL =
    process.env.ENTITY_CORE_API_URL ||
    process.env.NEXT_PUBLIC_ENTITY_CORE_API_URL ||
    'http://localhost:8001';

export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);

        const entity = searchParams.get('entity');
        const field = searchParams.get('field');
        const parentField = searchParams.get('parentField');
        const parentValue = searchParams.get('parentValue');

        if (!entity) {
            return NextResponse.json(
                { error: 'Missing required query param: entity' },
                { status: 400 }
            );
        }

        const authHeader = req.headers.get('authorization');

        const backendUrl = new URL('/api/actions/foreign-key-options', ENTITY_CORE_API_URL);
        backendUrl.searchParams.set('entity', entity);

        if (field) backendUrl.searchParams.set('field', field);
        if (parentField) backendUrl.searchParams.set('parentField', parentField);
        if (parentValue) backendUrl.searchParams.set('parentValue', parentValue);

        const res = await fetch(backendUrl.toString(), {
            method: 'GET',
            headers: {
                Accept: 'application/json',
                ...(authHeader ? { Authorization: authHeader } : {}),
            },
            cache: 'no-store',
        });

        const payload = await res.json().catch(() => null);

        if (!res.ok) {
            return NextResponse.json(
                {
                    error: 'Failed to load foreign key options',
                    status: res.status,
                    detail: payload,
                },
                { status: res.status }
            );
        }

        return NextResponse.json(payload ?? {});
    } catch (err) {
        console.error('foreign-key-options route error:', err);

        return NextResponse.json(
            {
                error:
                    err instanceof Error
                        ? err.message
                        : 'Unexpected foreign-key-options route error',
            },
            { status: 500 }
        );
    }
}