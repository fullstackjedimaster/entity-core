export async function apiFetchRaw(
    path: string,
    token?: string | null,
    options: RequestInit = {}
): Promise<Response> {
    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        ...(options.headers as Record<string, string>),
    };
    if (token) headers["Authorization"] = `Bearer ${token}`;

    return fetch(`${settings.ENTITY_CORE_API_BASE_URL}${path}`, {
        ...options,
        headers,
        credentials: "include",
    });
}
