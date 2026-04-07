'use client';

import React, { useEffect, useRef, useState } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';

const EntityFormElement = "entity-form" as any;

// 🔧 Where the form engine (entity-core-ui / crud-client) lives.
// You can point this at entity-core-ui when that DNS is ready.
const ENTITY_UI_ORIGIN =
    process.env.NEXT_PUBLIC_ENTITY_UI_ORIGIN ??
    'https://crud-client.fullstackjedi.dev';

// -----------------------------------------------------------------------------
// Custom element interface for ref typing
// -----------------------------------------------------------------------------
interface EntityFormElement extends HTMLElement {
    jwt?: string | null;
}

// -----------------------------------------------------------------------------
// Define <entity-form> web component
// -----------------------------------------------------------------------------
function defineEntityFormElement() {
    if (typeof window === 'undefined') return;
    if (customElements.get('entity-form')) return;

    class EntityFormElementImpl extends HTMLElement {
        private iframe: HTMLIFrameElement | null = null;
        private token: string | null = null;

        static get observedAttributes() {
            return ['entity', 'entity-id'];
        }

        connectedCallback() {
            // Shadow root + iframe
            if (!this.iframe) {
                const shadow = this.attachShadow({ mode: 'open' });
                const iframe = document.createElement('iframe');

                iframe.style.border = '0';
                iframe.style.width = '100%';
                iframe.style.minHeight = '600px';
                iframe.setAttribute('title', 'Entity form');

                shadow.appendChild(iframe);
                this.iframe = iframe;
            }
            this.updateIframeSrc();
        }

        attributeChangedCallback(
            name: string,
            oldValue: string | null,
            newValue: string | null
        ) {
            if (oldValue !== newValue) {
                this.updateIframeSrc();
            }
        }

        // Property setter for JWT (so token is NOT exposed as an attribute)
        set jwt(value: string | null) {
            this.token = value;
            this.postToken();
        }

        private updateIframeSrc() {
            if (!this.iframe) return;

            const entity = this.getAttribute('entity') ?? '';
            const id = this.getAttribute('entity-id') ?? '';

            const params = new URLSearchParams();
            if (entity) params.set('entity', entity);
            if (id) params.set('id', id);

            const origin = ENTITY_UI_ORIGIN.replace(/\/$/, '');
            const url = `${origin}/embed/entity?${params.toString()}`;

            this.iframe.src = url;

            // When iframe loads, send token (if we have one)
            this.iframe.addEventListener(
                'load',
                () => {
                    this.postToken();
                },
                { once: true }
            );
        }

        private postToken() {
            if (!this.iframe || !this.token) return;

            try {
                this.iframe.contentWindow?.postMessage(
                    {
                        type: 'ENTITY_FORM_SET_TOKEN',
                        token: this.token,
                    },
                    ENTITY_UI_ORIGIN
                );
            } catch (err) {
                console.error(
                    '[entity-form] Failed to post token to iframe:',
                    err
                );
            }
        }
    }

    customElements.define('entity-form', EntityFormElementImpl);
}

// -----------------------------------------------------------------------------
// Page component
// -----------------------------------------------------------------------------
export default function EntityDetailPage() {
    const params = useParams() as { entityName?: string; id?: string };
    const entityName = params.entityName ?? '';
    const id = params.id ?? '';

    const { getToken } = useAuth();
    const [token, setToken] = useState<string | null>(null);
    const [tokenError, setTokenError] = useState<string | null>(null);
    const formRef = useRef<EntityFormElement | null>(null);

    // Define custom element once on client
    useEffect(() => {
        defineEntityFormElement();
    }, []);

    // Fetch JWT from AuthContext
    useEffect(() => {
        let cancelled = false;

        (async () => {
            try {
                const t = await getToken();
                if (!cancelled) {
                    setToken(t ?? null);
                    if (!t) {
                        setTokenError('No access token available.');
                    }
                }
            } catch (err) {
                console.error('[EntityDetailPage] getToken error:', err);
                if (!cancelled) {
                    setTokenError('Failed to acquire access token.');
                    setToken(null);
                }
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [getToken]);

    // Push JWT into the web component via property setter
    useEffect(() => {
        if (!formRef.current) return;
        if (!token) return;

        formRef.current.jwt = token;
    }, [token]);

    if (!entityName || !id) {
        return (
            <div className="p-4">
                <h1 className="text-xl font-semibold mb-2">Entity detail</h1>
                <p className="text-sm text-gray-600">
                    Missing entity type or id in the URL.
                </p>
            </div>
        );
    }

    return (
        <div className="p-4 space-y-3">
            <h1 className="text-xl font-semibold">Entity detail</h1>

            {tokenError && (
                <p className="text-sm text-red-600">
                    {tokenError} Forms may not be able to load data.
                </p>
            )}

            {/* Web component host */}
            {/* Web component host */}
            <EntityFormElement
                ref={formRef as any}
                entity={entityName}
                entity-id={id}
                /* same props as before */
            >
            </EntityFormElement>

        </div>
    );
}
