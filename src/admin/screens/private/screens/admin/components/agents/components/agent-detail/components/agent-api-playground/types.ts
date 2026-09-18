import type { ReactFormExtendedApi } from '@tanstack/react-form';

import type { ApiAgentType, DynamicFormType } from '@/types/admin';

export interface Props {
    agent: ApiAgentType;
}

export interface FileType {
    name: string;
    type?: string;
    url: string;
    _id?: string;
    size?: number;
}

export interface FilesStateType {
    [key: string]: {
        files: FileType[];
        isUploading: boolean;
    };
}

export interface AgentAPIPlaygroundFormPanelProps {
    agent: ApiAgentType;
    // TanStack's form generics are invariant, so a fully-typed form instance cannot interop
    // with the AnyFieldApi that FormField requires; any is the library-sanctioned escape here.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    dynamicForm: ReactFormExtendedApi<DynamicFormType, any, any, any, any, any, any, any, any, any, any, any>;
    disabled: boolean;
    loading: boolean;
    handleFilesChange: (name: string, files: FileType[]) => void;
    handleIsUploading: (name: string, isUploading: boolean) => void;
}
