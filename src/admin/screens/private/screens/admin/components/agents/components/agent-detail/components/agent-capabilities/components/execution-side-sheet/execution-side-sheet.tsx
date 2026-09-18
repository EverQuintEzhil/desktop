import { useForm, useStore } from '@tanstack/react-form';
import { WrenchIcon } from 'lucide-react';
import { useState, useEffect } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import JSONEditor from '@/components/json-editor';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import FormField from '@/components/ui/form-field';
import SideSheet from '@/components/ui/side-sheet';
import SpinnerBlade from '@/components/ui/spinner';
import { useExecuteAgentMutation } from '@/lib/api/admin/agents';
import { cn } from '@/lib/utils';
import type { AgentType } from '@/types/admin';
import { parseJsonIfValid } from '@/utils';

interface Props {
    onClose: () => void;
    isOpen: boolean;
    onExecute?: (agent: AgentType) => void;
    agent?: AgentType;
}

const ExecutionSideSheet = (props: Props) => {
    const { onClose: onCloseProp, isOpen, onExecute, agent } = props;
    const executeMutation = useExecuteAgentMutation();

    const isSubmitting = executeMutation.isPending;
    const [formError, setFormError] = useState('');

    const form = useForm({
        defaultValues: {
            configuration: {
                json: {},
            } as Content,
        },
        onSubmit: async ({ value }) => {
            setFormError('');
            try {
                const parsedCurrentValue = parseJsonIfValid(value.configuration);

                const obj = {
                    configuration: parsedCurrentValue,
                };

                const result = await executeMutation.mutateAsync({ id: agent!._id, data: obj });

                onExecute?.(result as AgentType);

                onClose();
            } catch (error: unknown) {
                console.error(error);
                const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
                const message = axiosError.response?.data?.message || 'Something went wrong. Please try again.';

                if (axiosError.response?.status === 500) {
                    setFormError('Internal server error, Please try again.');
                } else {
                    setFormError(message);
                }
            }
        },
    });

    const isDirty = useStore(form.store, (state) => state.isDirty);

    const formValues = useStore(form.store, (state) => state.values);

    useEffect(() => {
        if (formError) {
            setFormError('');
        }
    }, [formValues]);

    const onClose = () => {
        form.reset({
            configuration: {
                json: {},
            } as Content,
        });
        setFormError('');
        onCloseProp();
    };

    return (
        <SideSheet
            isOpen={isOpen}
            onClose={onClose}
            renderTitle={() => <>Execute Tools</>}
            renderFooter={() => (
                <Button
                    onClick={form.handleSubmit}
                    className="add-prompt-save-button ml-auto flex"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? <SpinnerBlade /> : null}
                    {isSubmitting ? 'Executing' : 'Execute'}
                </Button>
            )}
            showConfirmOnClose={isDirty}
            classNameContent="flex flex-col add-prompt-content pb-0"
        >
            <div className="flex flex-col gap-4 pb-4">
                <form.Field
                    name="configuration"
                    children={(field) => (
                        <FormField label="Configuration" field={field} required>
                            {(isErrored) => (
                                <JSONEditor
                                    isErrored={isErrored}
                                    content={field.state.value as Content}
                                    onBlur={field.handleBlur}
                                    onChange={(content: Content) => {
                                        field.handleChange(content);
                                    }}
                                />
                            )}
                        </FormField>
                    )}
                    validators={{
                        onChange: ({ value }) => {
                            const parsedCurrentValue = parseJsonIfValid(value);

                            if (!parsedCurrentValue || Object.keys(parsedCurrentValue).length === 0) {
                                return 'Configuration is required';
                            }

                            return null;
                        },
                    }}
                />

                <div className="execution-side-sheet-tools flex flex-col gap-3">
                    <div className="flex items-center justify-between gap-2">
                        <h5 className="text-base font-semibold tracking-tight">Tools</h5>
                        {agent?.tools && agent.tools.length > 0 ? (
                            <span className="text-xs font-medium text-text-secondary tabular-nums">
                                {agent.tools.length} {agent.tools.length === 1 ? 'tool' : 'tools'}
                            </span>
                        ) : null}
                    </div>
                    {!agent?.tools?.length ? (
                        <div
                            className={cn(
                                'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed',
                                'border-border-secondary bg-muted/30 px-4 py-8 text-center',
                            )}
                        >
                            <WrenchIcon className="opacity-70" />
                            <p className="text-sm font-medium text-text-secondary">No tools attached to this agent</p>
                            <p className="max-w-sm text-xs text-text-secondary">
                                Add tools in agent capabilities before executing.
                            </p>
                        </div>
                    ) : (
                        <ul className="flex flex-col gap-2">
                            {agent.tools.map((tool) => (
                                <li
                                    key={tool._id}
                                    className={cn(
                                        'execution-side-sheet-tool-row flex gap-3 rounded-lg border',
                                        'border-border-secondary bg-background p-3 transition-colors',
                                        'hover:bg-muted/40',
                                    )}
                                >
                                    <div
                                        className={cn(
                                            'flex h-10 w-10 shrink-0 items-center justify-center rounded-md',
                                            'bg-muted/50 text-text-secondary',
                                        )}
                                        aria-hidden
                                    >
                                        <WrenchIcon />
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex flex-wrap items-center gap-2 gap-y-1">
                                            <span className="font-medium text-foreground">{tool.name}</span>
                                            {tool.isDev ? (
                                                <Badge
                                                    variant="outline"
                                                    className="text-[10px] tracking-wide uppercase"
                                                >
                                                    Dev
                                                </Badge>
                                            ) : null}
                                        </div>
                                        {tool.refName ? (
                                            <p className="mt-0.5 font-mono text-xs text-text-secondary">
                                                {tool.refName}
                                            </p>
                                        ) : null}
                                        {tool.description ? (
                                            <p className="mt-1 line-clamp-2 text-sm text-text-secondary">
                                                {tool.description}
                                            </p>
                                        ) : null}
                                    </div>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            </div>
            {formError && (
                <div className="sticky bottom-0 z-1 mt-auto bg-card py-2">
                    <span className="text-sm font-medium text-destructive">{formError}</span>
                </div>
            )}
        </SideSheet>
    );
};

export default ExecutionSideSheet;
