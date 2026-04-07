"use client";

import { Suspense, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { settings } from "@/lib/settings";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Wrapper component to satisfy Next's requirement that
 * useSearchParams() be used inside a Suspense boundary.
 */
export default function OnboardingPage() {
    return (
        <Suspense
            fallback={
                <main className="p-6 max-w-md mx-auto">
                    <h1 className="text-2xl font-bold mb-4">
                        Create Your Organization
                    </h1>
                    <p className="text-gray-700">Loading onboarding…</p>
                </main>
            }
        >
            <OnboardingInner />
        </Suspense>
    );
}

/**
 * Onboarding creates an organization schema and assigns the user to it.
 * After provisioning, we redirect to:
 *
 *   https://AUTH0_DOMAIN/continue?state=STATE
 *
 * Which triggers `onContinuePostLogin` and causes Auth0 to re-mint the
 * refresh token + access token *with* the new org_id/schema claims included.
 */
function OnboardingInner() {
    const router = useRouter();
    const params = useSearchParams();

    const sessionToken = params.get("session_token") || "";
    const stateParam = params.get("state") || "";

    const [decoded, setDecoded] = useState<any>(null);
    const [orgKey, setOrgKey] = useState("");
    const { isAuthenticated, getToken, user } = useAuth();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Decode onboarding session token
    useEffect(() => {
        if (!sessionToken) return;
        try {
            const body = sessionToken.split(".")[1];
            const json = atob(body.replace(/-/g, "+").replace(/_/g, "/"));
            setDecoded(JSON.parse(json));
        } catch (err) {
            console.error("Failed to decode session token:", err);
            setError("Invalid session token.");
        }
    }, [sessionToken]);

    // Wait for Auth0 app_metadata propagation
    const waitForAuth0Metadata = async (sub: string, org: string) => {
        const url = `${settings.CRUD_SERVER_URL}/internal/wait_for_metadata?sub=${encodeURIComponent(
            sub
        )}&org_id=${encodeURIComponent(org)}`;

        for (let attempt = 0; attempt < 24; attempt++) {
            const res = await fetch(url);
            if (res.ok) return true;
            await new Promise((r) => setTimeout(r, 500));
        }

        return false;
    };

    const submit = async () => {
        try {
            setError(null);

            if (!sessionToken) {
                setError("Missing session token.");
                return;
            }

            const org = orgKey.trim().toLowerCase();
            if (!org) {
                setError("Please enter an organization name.");
                return;
            }

            setLoading(true);

            const body = {
                schema: org,
                sub: decoded?.sub,
                email: decoded?.email,
                name: decoded?.name || decoded?.email?.split("@")[0],
                picture: decoded?.picture || null,
            };

            const provRes = await fetch(
                `${settings.CRUD_SERVER_URL}/api/provision_tenant`,
                {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify(body),
                }
            );
            if (!provRes.ok) {
                const t = await provRes.text().catch(() => "");
                setError(`Provision failed (${provRes.status}): ${t}`);
                return;
            }
            const prov = await provRes.json();
            // Wait for Auth0 to reflect app_metadata (roles/perms/org_id)
            await waitForAuth0Metadata(
                decoded?.sub,
                prov?.app_metadata?.org_id || org
            );

            // Now ask Auth0 to re-mint tokens with claims
            window.location.href = `https://${process.env.NEXT_PUBLIC_AUTH0_DOMAIN}/continue?state=${stateParam}`;
        } catch (err: any) {
            console.error("[Onboarding] Error:", err);
            setError(err.message || "Unknown error");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="p-6 max-w-md mx-auto space-y-6">
            <h1 className="text-2xl font-bold">Create Your Organization</h1>

            {decoded && (
                <p className="text-gray-700">
                    Welcome, <strong>{decoded.name || decoded.email}</strong>
                </p>
            )}

            {error && <p className="text-red-600">{error}</p>}

            <input
                className="border rounded px-3 py-2 w-full"
                placeholder="organization key (e.g., acme)"
                value={orgKey}
                onChange={(e) => setOrgKey(e.target.value)}
            />

            <button
                onClick={submit}
                disabled={loading || !orgKey}
                className="w-full bg-blue-600 text-white py-2 rounded disabled:opacity-60"
            >
                {loading ? "Provisioning…" : "Continue"}
            </button>
        </main>
    );
}
