import { useForm } from '@tanstack/react-form';
import { SendIcon } from 'lucide-react';
import { useEffect } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import JSONEditor from '@/components/json-editor';
import { Button } from '@/components/ui/button';
import Spinner, { SpinnerBlade } from '@/components/ui/spinner';
import {
    useAgentBinaryQuery,
    useCreateAgentBinaryMutation,
    useUpdateAgentBinaryMutation,
} from '@/lib/api/admin/agents';
import type { AgentType } from '@/types/admin';
import { showErrorToast, parseJsonIfValid, showSuccessToast, safeJsonParse } from '@/utils';

import './agent-binary.scss';

interface Props {
    agent: AgentType;
    canUserEdit: boolean;
}

export type AgentBinaryType = {
    readonly _id: string;
    definition: string;
    agentId: string;
    agentIdentifier: string;
};

const AgentBinary = (props: Props) => {
    const { agent, canUserEdit } = props;

    const { data: binaryRaw, isLoading, isError, error } = useAgentBinaryQuery(agent._id);

    const createMutation = useCreateAgentBinaryMutation();
    const updateMutation = useUpdateAgentBinaryMutation();

    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    const axiosErr = error as { response?: { data?: { message?: string } } };
    const isBinaryNotExists =
        isError && (axiosErr?.response?.data?.message?.includes('There is no such binary') ?? false);

    const binaryData = binaryRaw as AgentBinaryType | undefined;

    const form = useForm({
        defaultValues: {
            definition: {
                json: [],
            } as Content,
        },
        onSubmit: async ({ value }) => {
            onSave(value);
        },
    });

    useEffect(() => {
        if (binaryData?._id) {
            form.setFieldValue('definition', { json: safeJsonParse(binaryData.definition, {}) } as Content);
        }
    }, [binaryData]);

    const onSave = async (value: { definition: Content }) => {
        try {
            const finalDefinition = parseJsonIfValid(value.definition);
            const obj = {
                definition: JSON.stringify(finalDefinition),
                version: 'v1',
            };

            if (binaryData?._id) {
                await updateMutation.mutateAsync({ id: agent._id, data: obj });
            } else {
                await createMutation.mutateAsync({ id: agent._id, data: obj });
            }
            showSuccessToast('Binary saved successfully.');
        } catch (err) {
            console.error(err);
            showErrorToast('Failed to save binary. Please try again.');
        }
    };

    if (isLoading) {
        return (
            <div className="binary-loading-wrapper flex min-h-[calc(100svh-48px-83px)] items-center justify-center px-4 py-6">
                <div className="flex flex-col items-center justify-center gap-6">
                    <Spinner className="scale-150" />
                    <span className="text-sm">Fetching binary...</span>
                </div>
            </div>
        );
    }
    if (isError) {
        if (isBinaryNotExists) {
            return (
                <div className="tab-content binary-tab binary-empty-state flex h-[80svh] flex-col items-center justify-center gap-2">
                    <span className="text-sm">Binary does not exist. Please create a new binary.</span>
                    {canUserEdit && (
                        <Button onClick={form.handleSubmit} size="sm" disabled={!canUserEdit}>
                            {isSubmitting ? <Spinner className="mr-2" /> : <SendIcon className="mr-2" />}
                            {isSubmitting ? 'Creating...' : 'Create New Binary'}
                        </Button>
                    )}
                </div>
            );
        }

        return (
            <div className="flex items-center justify-center px-4 py-6">
                <div className="flex flex-col items-center justify-center gap-6">
                    <h2 className="text-center font-medium">Error</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="tab-content binary-tab flex flex-col gap-2">
            {canUserEdit && (
                <Button onClick={form.handleSubmit} size="sm" className="ml-auto flex" disabled={isSubmitting}>
                    {isSubmitting ? <SpinnerBlade className="scale-75" /> : null}
                    {isSubmitting ? 'Saving' : 'Save'}
                </Button>
            )}
            <form.Field
                name="definition"
                children={(field) => (
                    <JSONEditor
                        isErrored={false}
                        content={field.state.value}
                        readOnly={!canUserEdit}
                        onBlur={field.handleBlur}
                        onChange={(content: Content) => {
                            field.handleChange(content);
                        }}
                    />
                )}
                validators={{
                    onChange: ({ value }) => {
                        const parsedCurrentValue = parseJsonIfValid(value);

                        if (!parsedCurrentValue) {
                            return 'Configuration Secret is required';
                        }

                        return null;
                    },
                }}
            />
        </div>
    );
};

export default AgentBinary;
