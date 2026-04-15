export type Primitive = string | number | boolean | null;

export interface ObjectShape {
    [key: string]: Primitive | ObjectShape | ObjectShape[];
}

export type EntityJsonShape = ObjectShape;

export type FormState = Record<string, unknown>;
