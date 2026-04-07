"use client";

import { useEffect } from "react";

type Beacon = {
    type: "EMBED_HEIGHT";
    frameId?: string;
    height: number;
};

export default function EmbedHeightReporter() {
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const frameId = params.get("frameId") || undefined;

        let raf = 0;
        let last = 0;

        const post = (h: number) => {
            const now = Date.now();
            // throttle to ~15fps
            if (now - last < 66) return;
            last = now;

            const msg: Beacon = { type: "EMBED_HEIGHT", frameId, height: h };
            if (window.parent && window.parent !== window) {
                try {
                    window.parent.postMessage(msg, "*");
                } catch {
                    // noop
                }
            }
        };

        const measure = () => {
            const body = document.body;
            const html = document.documentElement;
            const h = Math.max(
                body.scrollHeight,
                html.scrollHeight,
                body.offsetHeight,
                html.offsetHeight,
                body.clientHeight,
                html.clientHeight
            );
            post(h);
        };

        const ro = new ResizeObserver(() => {
            cancelAnimationFrame(raf);
            raf = requestAnimationFrame(measure);
        });

        ro.observe(document.documentElement);
        ro.observe(document.body);

        // initial + safety pings
        measure();
        const onLoad = () => measure();
        const onOrient = () => measure();
        window.addEventListener("load", onLoad);
        window.addEventListener("orientationchange", onOrient);

        return () => {
            window.removeEventListener("load", onLoad);
            window.removeEventListener("orientationchange", onOrient);
            ro.disconnect();
            cancelAnimationFrame(raf);
        };
    }, []);

    return null;
}
