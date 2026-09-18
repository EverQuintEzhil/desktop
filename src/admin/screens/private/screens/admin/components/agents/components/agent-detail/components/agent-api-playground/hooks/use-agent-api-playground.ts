import { useForm } from '@tanstack/react-form';
import { useState } from 'react';

import { appAgentApi } from '@/lib/api/app/agent';
import type { ApiAgentType, DynamicFormType, FieldType } from '@/types/admin';

import { INPUT_TYPES_DEFAULT_VALUE } from '../constants';
import type { FilesStateType, FileType } from '../types';
import buildFinalFormValues from '../utils/build-final-form-values';

const getDefaultValue = (agent: ApiAgentType): DynamicFormType => {
    const defaultValues: DynamicFormType = {};

    agent.uiConfig.formSpec
        ?.filter((field) => field.inputType !== 'filesupload')
        ?.forEach((formField: FieldType) => {
            const key = formField.name;
            const value = INPUT_TYPES_DEFAULT_VALUE[formField.inputType];

            defaultValues[key] = value;
        });

    return defaultValues;
};

/**
 * Owns the playground's request/response lifecycle: uploaded-file tracking,
 * the dynamic tanstack-form instance, and sending/re-sending the chat request.
 */
const useAgentAPIPlayground = (agent: ApiAgentType) => {
    const [isSending, setIsSending] = useState(false);
    const [response, setResponse] = useState<Record<string, unknown> | null>(null);
    const [filesState, setFileState] = useState<FilesStateType>({});
    const isFilesUploading = Object.values(filesState).some((files) => files.isUploading);

    const isFileNotUploaded = agent.uiConfig.formSpec?.some((field) => {
        if (field.inputType === 'filesupload' && field.required) {
            if (!filesState?.[field.name] || filesState?.[field.name]?.files?.length === 0) {
                return true;
            }
        }

        return false;
    });

    const handleFilesChange = (name: string, files: FileType[]) => {
        setFileState((prevState) => {
            const prevFiles = prevState[name];

            return {
                ...prevState,
                [name]: { files, isUploading: prevFiles ? prevFiles.isUploading : false },
            };
        });
    };

    const handleIsUploading = (name: string, isUploading: boolean) => {
        setFileState((prevState) => {
            const prevFiles = prevState[name];

            return {
                ...prevState,
                [name]: { isUploading, files: prevFiles ? prevFiles.files : [] },
            };
        });
    };

    const onSendRequest = async (values: DynamicFormType) => {
        const filesArg: FileType[] = Object.values(filesState).flatMap((item) => item.files);
        const finalFormValues = buildFinalFormValues(agent, values);

        if (isFileNotUploaded) {
            return;
        }

        setIsSending(true);
        setResponse(null);

        try {
            const fileIds = filesArg.map((file) => file._id).filter((id): id is string => Boolean(id));
            const result = await appAgentApi.executeChat<Record<string, unknown>>(
                {
                    agentIdOrIdentifier: agent.identifier,
                    conversationId: null,
                    ...(fileIds.length > 0 && { fileIds }),
                    arguments: {
                        ...finalFormValues,
                    },
                    options: {
                        stream: false,
                    },
                },
                { headers: { 'Content-Type': 'application/json' } },
            );

            setResponse(result);
        } catch (err) {
            console.error('Error sending request:', err);
            const errorMessage =
                err instanceof Error && 'response' in err
                    ? (err as { response?: { data?: { message?: string }; status?: number } }).response?.data
                          ?.message || 'Failed to send request'
                    : 'Failed to send request';
            const errorStatus =
                err instanceof Error && 'response' in err
                    ? (err as { response?: { data?: { message?: string }; status?: number } }).response?.status || 500
                    : 500;

            setResponse({
                error: errorMessage,
                status: errorStatus,
                timestamp: new Date().toISOString(),
            });
        } finally {
            setIsSending(false);
        }
    };

    const dynamicForm = useForm({
        defaultValues: getDefaultValue(agent),
        onSubmit: async ({ value }) => {
            onSendRequest(value);
        },
    });

    return {
        isSending,
        response,
        filesState,
        isFilesUploading,
        isFileNotUploaded,
        handleFilesChange,
        handleIsUploading,
        dynamicForm,
    };
};

export default useAgentAPIPlayground;
