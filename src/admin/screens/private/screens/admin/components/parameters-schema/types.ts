import type { ReactFormExtendedApi } from '@tanstack/react-form';
import type { Content } from 'vanilla-jsoneditor';

import type { AgentType, AppType, ModelType, ToolType } from '@/types/admin';

/** Add a row here when a new entity supports parameters schema; props union updates automatically. */
export type ParametersSchemaDataMap = {
    tools: ToolType;
    agents: AgentType;
    models: ModelType;
    apps: AppType;
};

export type ParametersSchemaProps = {
    canUserEdit: boolean;
} & {
    [K in keyof ParametersSchemaDataMap]: {
        dataType: K;
        data: ParametersSchemaDataMap[K];
        onSubmit: (value: ParametersSchemaDataMap[K]) => void;
    };
}[keyof ParametersSchemaDataMap];

export type ParametersSchemaType = {
    readonly _id: string;
    definition: string;
    dataId: string;
    dataType: string;
};

/** `useForm`'s eleven validator-shape generics are the same `any`-instantiated escape hatch
 * used by `MemoryFormApi` in `add-memory/types.ts` — only the data shape is meaningful here. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- mirrors the library's own AnyFormApi/AnyFieldApi pattern for a cross-component form prop
export type ParametersSchemaFormApi = ReactFormExtendedApi<
    { parameters: Content },
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any,
    any
>;
