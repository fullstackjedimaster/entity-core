export type Primitive = string | number | boolean | null;

export interface ObjectShape {
    [key: string]: Primitive | ObjectShape | ObjectShape[];
}

export type TemplateShape = ObjectShape;

export type FormState = Record<string, unknown>;
