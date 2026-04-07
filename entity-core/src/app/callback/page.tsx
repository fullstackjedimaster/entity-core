'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function CallbackPage() {
    const router = useRouter();

    useEffect(() => {
        // After redirect callback is handled in AuthProvider, just go home
        const timer = setTimeout(() => {
            router.replace('/');
        }, 400);

        return () => clearTimeout(timer);
    }, [router]);

    return (
        <main className="flex items-center justify-center min-h-screen text-center">
            <p>Completing login…</p>
        </main>
    );
}
