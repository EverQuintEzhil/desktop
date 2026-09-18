import { useForm, useStore } from '@tanstack/react-form';
import { useState, useRef, useEffect } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';
import type { Content } from 'vanilla-jsoneditor';

import JSONEditor from '@/components/json-editor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import FormField from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import Select, { type SelectSuggestionItem } from '@/components/ui/select';
import SideSheet from '@/components/ui/side-sheet';
import SpinnerBlade from '@/components/ui/spinner';
import { useCreateAgentMutation, useUpdateAgentMutation } from '@/lib/api/admin/agents';
import type { AgentType, AgentTypeEnum } from '@/types/admin';
import { parseJsonIfValid } from '@/utils';

import './add-agent.scss';

interface Props {
    onClose: () => void;
    isOpen: boolean;
    onCreateSuccess?: (agent: AgentType) => void;
    agent?: AgentType;
}

const AddAgent = (props: Props) => {
    const { onClose: onCloseProp, isOpen, onCreateSuccess, agent } = props;

    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation();

    const createMutation = useCreateAgentMutation();
    const updateMutation = useUpdateAgentMutation();

    const isSubmitting = createMutation.isPending || updateMutation.isPending;

    const [formError, setFormError] = useState('');

    const isSlugEditedByUserRef = useRef(false);

    const onSave = async (
        value: Omit<AgentType, 'type'> &
            Omit<AgentType, 'historySpec'> & {
                type: SelectSuggestionItem<AgentTypeEnum>;
                version: SelectSuggestionItem<string>;
                historySpec: Content;
            },
    ) => {
        setFormError('');
        try {
            const parsedCurrentValue = parseJsonIfValid(value.historySpec);
            const obj = {
                name: value.name.trim(),
                identifier: value.identifier.trim(),
                slug: value.slug,
                dev: value.dev || false,
                historyEnabled: value.historyEnabled || false,
                historySpec: value.historyEnabled ? parsedCurrentValue : null,
                conversationsEnabled: value.conversationsEnabled || false,
                type: value.type.value || 'chat',
                version: agent ? undefined : 'v2',
            };

            if (agent) {
                const updatedAgent = await updateMutation.mutateAsync({
                    id: agent._id,
                    data: obj,
                    routeSlugOrId: params.agentId,
                });

                const routeSeg = params.agentId?.trim();
                const newSlug = updatedAgent.slug?.trim();

                if (routeSeg && newSlug && routeSeg !== newSlug) {
                    const prefix = `/admin/agents/${routeSeg}`;

                    if (location.pathname.startsWith(prefix)) {
                        navigate(`${'/admin/agents/'}${newSlug}${location.pathname.slice(prefix.length)}`, {
                            replace: true,
                        });
                    }
                }
            } else {
                const newAgent = await createMutation.mutateAsync(obj as Partial<AgentType>);

                onCreateSuccess?.(newAgent as AgentType);
            }
            onClose();
        } catch (error: unknown) {
            console.error(error);
            const axiosError = error as { response?: { data?: { message?: string } } };
            const message = axiosError.response?.data?.message || 'Something went wrong. Please try again.';

            if (message.includes('E11000') && message.includes('duplicate key') && message.includes('slug')) {
                form.setFieldMeta('slug', (prev) => ({
                    ...prev,
                    errorMap: {
                        onServer: 'An agent with this slug already exists.',
                    },
                }));
            } else if (
                message.includes('E11000') &&
                message.includes('duplicate key') &&
                message.includes('identifier')
            ) {
                form.setFieldMeta('identifier', (prev) => ({
                    ...prev,
                    errorMap: {
                        onServer: 'An agent with this identifier already exists.',
                    },
                }));
            } else {
                setFormError(message);
            }
        }
    };

    const form = useForm({
        defaultValues: {
            name: agent?.name || '',
            identifier: agent?.identifier || '',
            dev: agent?.dev || false,
            historyEnabled: agent?.historyEnabled || false,
            historySpec: {
                json: agent?.historySpec || {},
            } as Content,
            conversationsEnabled: agent?.conversationsEnabled || false,
            slug: agent?.slug || '',
            type: agent?.type
                ? ({
                      value: agent?.type,
                      label: agent?.type,
                  } as SelectSuggestionItem<AgentTypeEnum>)
                : ({
                      value: 'chat',
                      label: 'chat',
                  } as SelectSuggestionItem<AgentTypeEnum>),
        },
        onSubmit: async ({ value }) => {
            onSave(
                value as Omit<AgentType, 'type'> &
                    Omit<AgentType, 'historySpec'> &
                    Omit<AgentType, 'version'> & {
                        type: SelectSuggestionItem<AgentTypeEnum>;
                        version: SelectSuggestionItem<string>;
                        historySpec: Content;
                    },
            );
        },
    });

    const isDirty = useStore(form.store, (state) => state.isDirty);
    const historyEnabled = useStore(form.store, (state) => state.values.historyEnabled);
    const formValues = useStore(form.store, (state) => state.values);

    useEffect(() => {
        if (!historyEnabled) {
            form.setFieldMeta('historySpec', (prev) => {
                return {
                    ...prev,
                    errorMap: {},
                };
            });
        }
    }, [historyEnabled]);

    useEffect(() => {
        if (formError) {
            setFormError('');
        }
    }, [formValues]);

    const onClose = () => {
        form.reset({
            name: '',
            identifier: '',
            slug: '',
            type: {
                value: 'chat',
                label: 'chat',
            },
            dev: false,
            historyEnabled: false,
            historySpec: { json: {} } as Content,
            conversationsEnabled: false,
        });
        isSlugEditedByUserRef.current = false;
        setFormError('');
        onCloseProp();
    };

    const handleNameChange = (newName: string) => {
        const slugValue = newName
            .toLowerCase()
            .replace(/[^a-z0-9- ]/g, '') // remove special characters except hyphen and space
            .replace(/\s+/g, '-') // replace spaces with hyphen
            .replace(/-+/g, '-') // replace multiple hyphens with single
            .replace(/^-+|-+$/g, '');

        if (!isSlugEditedByUserRef.current) {
            form.setFieldValue('slug', slugValue);
        }
    };

    return (
        <SideSheet
            isOpen={isOpen}
            onClose={onClose}
            renderTitle={() => <>{agent ? 'Edit Agent' : 'Add Agent'}</>}
            renderFooter={() => (
                <Button
                    onClick={form.handleSubmit}
                    className="add-agent-save-button ml-auto flex"
                    disabled={isSubmitting}
                >
                    {isSubmitting ? <SpinnerBlade className="scale-75" /> : null}
                    {isSubmitting ? 'Saving' : 'Save'}
                </Button>
            )}
            showConfirmOnClose={isDirty}
            classNameContent="flex flex-col add-agent-content pb-0"
        >
            <div className="add-agent-form flex flex-col gap-4 pb-4">
                <form.Field
                    name="name"
                    children={(field) => (
                        <FormField label="Name" field={field} required>
                            {(isErrored) => (
                                <Input
                                    name={field.name}
                                    isErrored={isErrored}
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(e) => {
                                        handleNameChange(e.target.value);
                                        field.handleChange(e.target.value);
                                    }}
                                />
                            )}
                        </FormField>
                    )}
                    validators={{
                        onChange: ({ value }) => {
                            if (!value?.trim()) {
                                return 'Name is required';
                            }

                            return null;
                        },
                    }}
                />
                <form.Field
                    name="identifier"
                    children={(field) => (
                        <FormField label="Identifier" field={field} required>
                            {(isErrored) => (
                                <Input
                                    name={field.name}
                                    isErrored={isErrored}
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(e) => {
                                        if (field.state.meta.errorMap?.onServer) {
                                            form.setFieldMeta('identifier', (prev) => ({
                                                ...prev,
                                                errorMap: {},
                                            }));
                                        }
                                        field.handleChange(e.target.value);
                                    }}
                                />
                            )}
                        </FormField>
                    )}
                    validators={{
                        onChange: ({ value }) => {
                            if (!value?.trim()) {
                                return 'identifier is required';
                            }

                            return null;
                        },
                    }}
                />
                <form.Field
                    name="type"
                    children={(field) => (
                        <FormField label="Type" field={field} required>
                            {() => (
                                <Select<AgentTypeEnum>
                                    variant="ghost"
                                    placeholder="Select"
                                    options={[
                                        { value: 'chat', label: 'chat' },
                                        { value: 'api', label: 'api' },
                                    ]}
                                    value={field.state.value?.value ?? null}
                                    onChange={(val) => {
                                        field.handleChange(
                                            val != null
                                                ? { value: val, label: val }
                                                : (undefined as unknown as SelectSuggestionItem<AgentTypeEnum>),
                                        );
                                        field.handleBlur();
                                    }}
                                />
                            )}
                        </FormField>
                    )}
                    validators={{
                        onChange: ({ value }) => {
                            if (!value) {
                                return 'Type is required';
                            }

                            return null;
                        },
                    }}
                />
                <form.Field
                    name="slug"
                    children={(field) => (
                        <FormField label="Slug" field={field} required>
                            {(isErrored) => (
                                <Input
                                    name={field.name}
                                    isErrored={isErrored}
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(e) => {
                                        if (!isSlugEditedByUserRef.current) {
                                            isSlugEditedByUserRef.current = true;
                                        }
                                        if (field.state.meta.errorMap?.onServer) {
                                            form.setFieldMeta('slug', (prev) => ({
                                                ...prev,
                                                errorMap: {},
                                            }));
                                        }
                                        field.handleChange(e.target.value);
                                    }}
                                />
                            )}
                        </FormField>
                    )}
                    validators={{
                        onChange: ({ value }) => {
                            if (!value) {
                                return 'slug is required';
                            } else if (value?.includes(' ')) {
                                return 'Spaces are not allowed in the slug.';
                            } else if (/[A-Z]/.test(value)) {
                                return 'Slug should not contain uppercase letters.';
                            } else if (!/^[a-z0-9-]+$/.test(value)) {
                                return 'Slug should not contain special characters except hyphens.';
                            }

                            return null;
                        },
                    }}
                />
                <form.Field
                    name="dev"
                    children={(field) => (
                        <FormField label="" field={field}>
                            {() => (
                                <Checkbox
                                    label="Development Mode"
                                    checked={field.state.value}
                                    onChange={(_, val) => {
                                        field.handleChange(val);
                                    }}
                                />
                            )}
                        </FormField>
                    )}
                />
                <form.Field
                    name="conversationsEnabled"
                    children={(field) => (
                        <FormField label="" field={field}>
                            {() => (
                                <Checkbox
                                    label="Conversations Enabled"
                                    checked={field.state.value}
                                    onChange={(_, val) => {
                                        field.handleChange(val);
                                    }}
                                />
                            )}
                        </FormField>
                    )}
                />
                <form.Field
                    name="historyEnabled"
                    children={(field) => (
                        <FormField label="" field={field}>
                            {() => (
                                <Checkbox
                                    label="History Enabled"
                                    checked={field.state.value}
                                    onChange={(_, val) => {
                                        field.handleChange(val);
                                    }}
                                />
                            )}
                        </FormField>
                    )}
                />
                {historyEnabled && (
                    <form.Field
                        name="historySpec"
                        children={(field) => (
                            <FormField label="History Spec" field={field} required={historyEnabled}>
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

                                if (
                                    historyEnabled &&
                                    (!parsedCurrentValue || Object.keys(parsedCurrentValue).length === 0)
                                ) {
                                    return 'History Spec is required';
                                }

                                return null;
                            },
                        }}
                    />
                )}
            </div>
            {formError && (
                <div className="add-agent-error sticky bottom-0 z-1 mt-auto bg-card py-2">
                    <span className="text-sm font-medium text-destructive">{formError}</span>
                </div>
            )}
        </SideSheet>
    );
};

export default AddAgent;
