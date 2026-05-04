'use client';

import React, {
    Suspense,
    useEffect,
    useState,
    useCallback,
} from "react";
import { useSearchParams } from "next/navigation";
export const dynamic = 'force-dynamic';

import EntityComponent from "@/components/EntityComponent";
import { settings } from "@/lib/settings";

type EmbedConfig = {
    token: string | null;
    schema: string | null;
    apiBase: string;
};

/**
 * Inner component that uses useSearchParams and all the embed logic.
 * Wrapped in <Suspense> by the page component below.
 */
function EmbedContent() {
    const searchParams = useSearchParams();
    const entity = searchParams.get("entity") ?? "";
    const id = searchParams.get("id"); // optional, edit mode

    const [config, setConfig] = useState<EmbedConfig | null>(null);
    const [ready, setReady] = useState(false);

    // ---------------------------------------------------------------------
    // 1) Initial config from querystring (?token=&schema=&apiBase=)
    // ---------------------------------------------------------------------
    useEffect(() => {
        if (typeof window === "undefined") return;

        // const qsToken = searchParams.get("token");
        // const qsSchema = searchParams.get("schema");
        // const qsApiBase = searchParams.get("apiBase");
        //
        // if (!qsToken && !qsSchema && !qsApiBase) {
        //     return;
        // }
        //
        // const apiBase =
        //     qsApiBase && qsApiBase.trim().length > 0
        //         ? qsApiBase.trim()
        //         : settings.API_BASE_URL;
        //
        // if (qsToken && qsToken.trim()) {
        //     window.__ENTITY_CORE_JWT__ = qsToken.trim();
        // }
        //
        // if (qsSchema && qsSchema.trim()) {
        //     (window as any).__ENTITY_CORE_SCHEMA__ = qsSchema.trim();
        // }
        //
        // setConfig((prev) =>
        //     prev ??
        //     {
        //         token: qsToken ? qsToken.trim() : null,
        //         schema: qsSchema ? qsSchema.trim() : null,
        //         apiBase,
        //     },
        // );
        //
        // setReady(true);
    }, [searchParams]);

    // ---------------------------------------------------------------------
    // 2) Notify parent that the embed is ready to receive config
    // ---------------------------------------------------------------------
    useEffect(() => {
        if (typeof window === "undefined") return;

        const t = setTimeout(() => {
            // Newer, EntityCore-ish name:
            window.parent.postMessage({ type: "ENTITY_FORM_EMBED_READY" }, "*");
            // Backwards-compatible legacy name (safe no-op if unused):
            window.parent.postMessage({ type: "CRUD_EMBED_READY" }, "*");
        }, 0);

        return () => clearTimeout(t);
    }, []);

    // ---------------------------------------------------------------------
    // 3) Listen for config from parent (token/schema/apiBase overrides)
    // ---------------------------------------------------------------------
    useEffect(() => {
        if (typeof window === "undefined") return;

        function handler(event: MessageEvent) {
            const msg = event.data as any;
            if (!msg || typeof msg !== "object") return;

            // New contract: ENTITY_FORM_SET_CONFIG
            if (msg.type === "ENTITY_FORM_SET_CONFIG") {
                const token =
                    typeof msg.token === "string" && msg.token.trim()
                        ? msg.token.trim()
                        : null;
                const schema =
                    typeof msg.schema === "string" && msg.schema.trim()
                        ? msg.schema.trim()
                        : null;
                const apiBase =
                    typeof msg.apiBase === "string" && msg.apiBase.trim().length > 0
                        ? msg.apiBase.trim()
                        : settings.API_BASE_URL;

                // if (token) {
                //     window.__ENTITY_CORE_JWT__ = token;
                // }
                if (schema) {
                    (window as any).__ENTITY_CORE_SCHEMA__ = schema;
                }

                setConfig({ token, schema, apiBase });
                setReady(true);
                return;
            }

            // Legacy contract: CRUD_EMBED_CONFIG
            if (msg.type === "CRUD_EMBED_CONFIG") {
                const token =
                    typeof msg.token === "string" && msg.token.trim()
                        ? msg.token.trim()
                        : null;
                const schema =
                    typeof msg.schema === "string" && msg.schema.trim()
                        ? msg.schema.trim()
                        : null;
                const apiBase =
                    typeof msg.apiBase === "string" && msg.apiBase.trim().length > 0
                        ? msg.apiBase.trim()
                        : settings.API_BASE_URL;

                // if (token) {
                //     window.__ENTITY_CORE_JWT__ = token;
                // }
                if (schema) {
                    (window as any).__ENTITY_CORE_SCHEMA__ = schema;
                }

                setConfig({ token, schema, apiBase });
                setReady(true);
                return;
            }
        }

        window.addEventListener("message", handler);
        return () => window.removeEventListener("message", handler);
    }, []);

    // ---------------------------------------------------------------------
    // 4) Notify parent when the form successfully saves (optional flow)
    // ---------------------------------------------------------------------
    const handleSaved = useCallback((payload: unknown) => {
        if (typeof window === "undefined") return;
        window.parent.postMessage(
            {
                type: "ENTITY_FORM_SAVED",
                payload,
            },
            "*",
        );
    }, []);

    // ---------------------------------------------------------------------
    // 5) Render states
    // ---------------------------------------------------------------------

    if (!entity) {
        return (
            <div className="p-4 text-sm">
                <h1 className="font-semibold mb-2">EntityCore Embed</h1>
                <p>
                    Missing <code>?entity=</code> query parameter.
                </p>
            </div>
        );
    }

    if (!ready || !config) {
        return (
            <div className="p-4 text-sm">
                <h1 className="font-semibold mb-2">EntityCore Embed</h1>
                <p>Waiting for configuration from host application…</p>
            </div>
        );
    }

    // NOTE: EntityComponent currently reads API base + token indirectly
    // via api.ts (settings + window.__ENTITY_CORE_JWT__). Once you add
    // explicit props like apiBase/getToken/getSchema, you can do:
    //
    //   <EntityComponent
    //     entity={entity}
    //     id={id ?? undefined}
    //     onSaved={handleSaved}
    //     apiBase={config.apiBase}
    //     getToken={async () => config.token}
    //     getSchema={() => config.schema}
    //   />
    //
    // For now, we just render the basic component.
    return (
        <div className="w-full h-full p-4">
            <EntityComponent entityName={entity} />
        </div>
    );
}

/**
 * Page component that wraps the content in Suspense so Next is
 * satisfied with useSearchParams() bailouts.
 */
export default function EmbedPage() {
    return (
        <Suspense
            fallback={
                <div className="p-4 text-sm">
                    <h1 className="font-semibold mb-2">EntityCore Embed</h1>
                    <p>Loading…</p>
                </div>
            }
        >
            <EmbedContent />
        </Suspense>
    );
}
