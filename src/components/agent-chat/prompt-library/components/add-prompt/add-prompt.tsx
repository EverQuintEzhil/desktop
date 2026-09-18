import { useForm, useStore } from '@tanstack/react-form';

import { Button } from '@/components/ui/button';
import FormField from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import SideSheet from '@/components/ui/side-sheet';
import { appAgentApi } from '@/lib/api/app/agent';
import type { ChatAgentType, PromptType } from '@/types/admin';

interface Props {
    onClose: () => void;
    isOpen: boolean;
    onAddPrompt?: (prompt: PromptType) => void;
    prompt?: PromptType;
    agent: ChatAgentType;
}

const AddPrompt = (props: Props) => {
    const { onClose: onCloseProp, isOpen, onAddPrompt, prompt, agent } = props;

    const form = useForm({
        defaultValues: {
            name: prompt?.name || '',
        },
        onSubmit: async ({ value }) => {
            try {
                const obj = {
                    name: value.name.trim(),
                    prompt: prompt?.prompt || undefined,
                    agentIds: prompt?.agentIds || (agent._id ? [agent._id] : undefined),
                    isPrivate: true,
                    isPublished: false,
                };
                const response = await appAgentApi.createPrompt<PromptType>(obj);

                onAddPrompt?.(response);
                onClose();
            } catch (error) {
                console.error(error);
            }
        },
    });

    const isDirty = useStore(form.store, (state) => state.isDirty);

    const onClose = () => {
        form.reset({
            name: '',
        });
        onCloseProp();
    };

    return (
        <SideSheet
            isOpen={isOpen}
            onClose={onClose}
            renderTitle={() => <>{'Create a New Prompt'}</>}
            renderFooter={() => (
                <Button onClick={form.handleSubmit} className="ml-auto">
                    Save
                </Button>
            )}
            showConfirmOnClose={isDirty}
        >
            <div className="add-prompt-form flex flex-col gap-4">
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
            </div>
        </SideSheet>
    );
};

export default AddPrompt;
