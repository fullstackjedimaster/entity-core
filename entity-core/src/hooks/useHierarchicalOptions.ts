// src/hooks/useHierarchicalOptions.ts
"use client";

import { useState } from "react";
import { useOptions } from "./useOptions";

/**
 * Automatically manages chained selects like:
 *   org_hier1 → site_hier2 → panel_hier3
 * The naming convention is important:
 *   - Each level's name must end with _hierN
 *   - The next level's filter will include { [prevField]: selectedValue }
 */
export function useHierarchicalOptions(
    baseEntityName: string,
    hierarchyFields: string[],
    valueCol = "id",
    labelCol = "name"
) {
    const [selectedValues, setSelectedValues] = useState<Record<string, string | null>>({});

    const hooks = hierarchyFields.map((field, index) => {
        // Build filter based on the previous field's selection
        const filter: Record<string, string | number | null> = {};

        if (index > 0) {
            const prevField = hierarchyFields[index - 1];
            const prevValue = selectedValues[prevField];
            if (prevValue != null) {
                filter[prevField] = prevValue;
            }
        }

        const { options, isLoading, error } = useOptions(
            baseEntityName,
            valueCol,
            labelCol,
            filter
        );

        return {
            field,
            options,
            isLoading,
            error,
        };
    });

    function onChange(field: string, value: string | null) {
        setSelectedValues((prev) => {
            const next: Record<string, string | null> = { ...prev, [field]: value };
            // clear downstream selections
            const idx = hierarchyFields.indexOf(field);
            for (let i = idx + 1; i < hierarchyFields.length; i++) {
                next[hierarchyFields[i]] = null;
            }
            return next;
        });
    }

    return { hooks, selectedValues, onChange };
}
