// app/api/template/route.ts
import { NextRequest, NextResponse } from 'next/server';

const CRUD_SERVER_URL =
    process.env.NEXT_PUBLIC_CRUD_SERVER_URL ||
    process.env.CRUD_SERVER_URL ||
    'https://localhost:8002';

export async function GET(req: NextRequest) {
    const token = req.headers.get('authorization');
    if (!token) {
        return NextResponse.json(
            { error: 'Missing Authorization header' },
            { status: 401 }
        );
    }

    const upstream = await fetch(`${CRUD_SERVER_URL}/template`, {
        method: 'GET',
        headers: {
            Authorization: token,
        },
    });

    const body = await upstream.text();

    return new NextResponse(body, {
        status: upstream.status,
        headers: { 'Content-Type': 'application/json' },
    });
}
