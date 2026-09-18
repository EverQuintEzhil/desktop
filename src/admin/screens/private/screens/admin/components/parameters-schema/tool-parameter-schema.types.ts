export interface ParameterFieldDocRow {
    path: string;
    typeLabel: string;
    constraints: string[];
    exampleJson: string;
}

export interface ToolParameterSchema {
    type?: string;
    enum?: unknown[];
    oneOf?: Array<{ const?: unknown; title?: string }>;
    default?: unknown;
    description?: string;
    properties?: Record<string, ToolParameterSchema>;
    items?: ToolParameterSchema;
    required?: string[];
    additionalProperties?: boolean | ToolParameterSchema;
    minLength?: number;
    maxLength?: number;
    pattern?: string;
    format?: string;
    minimum?: number;
    maximum?: number;
    multipleOf?: number;
    minItems?: number;
    maxItems?: number;
    uniqueItems?: boolean;
    minProperties?: number;
    maxProperties?: number;
}
