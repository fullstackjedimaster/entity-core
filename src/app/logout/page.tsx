'use client';

import { useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';

/**
 * Logout page — ends local + Auth0 session cleanly
 */
export default function LogoutPage() {
    const { logout } = useAuth();   // ✅ pull logout from context

    useEffect(() => {
        logout();                   // ✅ call logout directly
    }, [logout]);

    return (
        <main className="flex items-center justify-center min-h-screen text-center">
            <p>Logging out…</p>
        </main>
    );
}
