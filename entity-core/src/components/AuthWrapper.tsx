'use client';

import React from 'react';
import {
    Auth0Provider,
    type AppState,
} from '@auth0/auth0-react';

import { settings } from '@/lib/settings';

export default function AuthWrapper({
    children,
}: {
    children: React.ReactNode;
}) {
    const redirectUri =
        typeof window !== 'undefined'
            ? `${window.location.origin}/callback`
            : settings.AUTH0_REDIRECT_URI;

    const onRedirectCallback = (appState?: AppState) => {
        if (typeof window === 'undefined') {
            return;
        }

        const returnTo =
            typeof appState?.returnTo === 'string'
                ? appState.returnTo
                : '/entities';

        window.history.replaceState(
            {},
            document.title,
            returnTo
        );

        window.location.replace(returnTo);
    };

    return (
        <Auth0Provider
            domain={settings.AUTH0_DOMAIN!}
            clientId={settings.AUTH0_CLIENT_ID!}
            authorizationParams={{
                redirect_uri: redirectUri,
                audience: settings.AUTH0_AUDIENCE!,
                scope: settings.AUTH0_SCOPE,
            }}
            cacheLocation="localstorage"
            useRefreshTokens={true}
            onRedirectCallback={onRedirectCallback}
        >
            {children}
        </Auth0Provider>
    );
}