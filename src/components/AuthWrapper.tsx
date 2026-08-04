'use client';

import React from 'react';
import {
    Auth0Provider,
    AppState,
} from '@auth0/auth0-react';
import { settings } from '@/lib/settings';

/**
 * Top-level Auth0 provider for Entity Core.
 * This is the only app that talks to Auth0 directly.
 */
export default function AuthWrapper({ children }: { children: React.ReactNode }) {
    const redirectUri =
        typeof window !== 'undefined'
            ? window.location.origin + '/callback'
            : settings.AUTH0_REDIRECT_URI ;

      const onRedirectCallback = () => {
        if (typeof window === 'undefined') return;

        const url = new URL(window.location.href);

        // 🔥 THIS is the key
        const state = url.searchParams.get('state');

        // You can route based on state if needed
        // For now just land cleanly
        window.history.replaceState({}, document.title, '/');

        window.location.replace('/entities');
    };
    return (
        <Auth0Provider
            domain={settings.AUTH0_DOMAIN!}
            clientId={settings.AUTH0_CLIENT_ID!}
            authorizationParams={{
                redirect_uri: redirectUri,
                audience: settings.AUTH0_AUDIENCE!,
                scope:
                    settings.AUTH0_SCOPE
                                                                                                                                                                               ,
            }}
            cacheLocation="localstorage"
            useRefreshTokens={true}
            onRedirectCallback={onRedirectCallback}
        >
            {children}
        </Auth0Provider>
    );
}
