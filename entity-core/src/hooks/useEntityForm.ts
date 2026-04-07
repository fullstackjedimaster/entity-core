"use client";

import { useState } from "react";
import type { TemplateShape, FormState, Primitive } from "@/types/form";

export interface UseEntityFormResult {
    form: FormState;
    updateField: (path: string[], value: Primitive) => void;
    addArrayRow: (path: string[], templateRow: TemplateShape) => void;
    removeArrayRow: (path: string[], index: number) => void;
}

export function useEntityForm(shape: TemplateShape | null): UseEntityFormResult {
    const [form, setForm] = useState<FormState>(() => (shape ? buildInitial(shape) : {}));

    function buildInitial(shape: TemplateShape): FormState {
        const result: FormState = {};

        for (const key of Object.keys(shape)) {
            const val = shape[key];

            if (Array.isArray(val)) {
                result[key] = [];
            } else if (val && typeof val === "object") {
                result[key] = buildInitial(val as TemplateShape);
            } else {
                result[key] = defaultPrimitive(val as Primitive);
            }
        }

        return result;
    }

    function defaultPrimitive(v: Primitive): Primitive {
        if (typeof v === "boolean") return false;
        if (typeof v === "number") return 0;
        return ""; // string base
    }

    function updateField(path: string[], value: Primitive) {
        setForm((prev) => {
            const next = structuredClone(prev);

            let ref: any = next;
            for (let i = 0; i < path.length - 1; i++) {
                if (ref[path[i]] == null) ref[path[i]] = {};
                ref = ref[path[i]];
            }

            ref[path[path.length - 1]] = value;
            return next;
        });
    }

    function addArrayRow(path: string[], templateRow: TemplateShape) {
        setForm((prev) => {
            const next = structuredClone(prev);

            let ref: any = next;
            for (let i = 0; i < path.length; i++) ref = ref[path[i]];
            ref.push(buildInitial(templateRow));

            return next;
        });
    }

    function removeArrayRow(path: string[], index: number) {
        setForm((prev) => {
            const next = structuredClone(prev);

            let ref: any = next;
            for (let i = 0; i < path.length; i++) ref = ref[path[i]];
            ref.splice(index, 1);

            return next;
        });
    }

    return { form, updateField, addArrayRow, removeArrayRow };
}
