'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

export default function CallbackPage() {
    const router = useRouter();
    const { isAuthenticated, loading } = useAuth();

    useEffect(() => {
        if (!loading && isAuthenticated) {
            router.replace('/entities');
        }
    }, [loading, isAuthenticated]);

    return (
        <main className="flex items-center justify-center min-h-screen text-center">
            <p>Completing login…</p>
        </main>
    );
}