import type { ReactNode } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import type { FormFieldProps } from '@/components/ui/form-field';
import type { SelectSuggestionItem } from '@/components/ui/select';
import type { AgentType, CodeTypeEnum, CodeLangEnum, ToolType, MemoryType } from '@/types/admin';

export interface Props<T> {
    type: CodeTypeEnum;
    lang: CodeLangEnum[];
    tool?: ToolType;
    agent?: AgentType;
    memory?: MemoryType;
    category: string;
    categoryFieldName: string;
    categoryId: string;
    categoryIdFieldName: string;
    selectedToolCodeId: string | null;
    canUserEdit: boolean;
    isExecutable?: boolean;
    onSubmit: (value: T) => void;
}

export interface CodeEditorField {
    state: { value: string };
    handleChange: (value: string) => void;
}

export interface ExecuteToolFormValues {
    parameters: Content;
    agentIds: SelectSuggestionItem<string>[];
    dataStoreIds: SelectSuggestionItem<string>[];
    modelIds: SelectSuggestionItem<string>[];
}

export interface ExecutionResultState {
    executed: boolean;
    error: string | null;
    errorName: string | null;
    luaErrorObject: Record<string, unknown> | null;
    data: unknown;
}

export type AnyFormFieldApi = FormFieldProps['field'];

export type ExecuteFormFieldProps = {
    name: keyof ExecuteToolFormValues;
    children: (field: AnyFormFieldApi) => ReactNode;
    validators?: {
        onChange?: (props: { value: unknown }) => string | null;
    };
};
