// src/types/entity-form.d.ts
import type React from "react";

declare global {
    namespace JSX {
        interface IntrinsicElements {
            "entity-form": React.DetailedHTMLProps<
                React.HTMLAttributes<HTMLElement>,
                HTMLElement
            > & {
                entity?: string;
                "entity-id"?: string;
            };
        }
    }
}

export {};
