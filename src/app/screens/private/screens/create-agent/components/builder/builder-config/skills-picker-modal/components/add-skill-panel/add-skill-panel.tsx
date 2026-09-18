import { useForm } from '@tanstack/react-form';
import { ArrowLeftIcon, PlusIcon, XIcon } from 'lucide-react';

import { pickerFormWrapCls } from '@/app/components/picker/picker-shared';
import { InstructionsEditor } from '@/components/instructions-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TextareaRoot } from '@/components/ui/textarea-form';
import { useCreateSkillMutation } from '@/lib/api/common/skills';
import { cn } from '@/lib/utils';
import { showErrorToast, showSuccessToast } from '@/utils';

import { btnCls, skillBtnCls } from '../../constants';

export interface AddSkillPanelProps {
    onBack: () => void;
    onClose: () => void;
    onSuccess: (skill: { _id: string; name: string }) => void;
}

const AddSkillPanel = ({ onBack, onClose, onSuccess }: AddSkillPanelProps) => {
    const createSkillMutation = useCreateSkillMutation();

    const form = useForm({
        defaultValues: {
            name: '',
            description: '',
            body: '',
        },
        onSubmit: async ({ value }) => {
            if (!value.name.trim()) {
                showErrorToast('Skill name is required.');

                return;
            }

            if (!value.body.trim()) {
                showErrorToast('Instructions are required.');

                return;
            }

            try {
                const response = await createSkillMutation.mutateAsync({
                    ...value,
                    name: value.name.trim(),
                    description: value.description.trim(),
                });

                showSuccessToast('Skill created successfully.');
                if (response?._id) {
                    onSuccess({ _id: response._id, name: response.name });
                }
            } catch {
                showErrorToast('Failed to create skill.');
            }
        },
    });

    return (
        <div className="flex h-full flex-col">
            <div className="modal-agent-header sticky top-0 z-2 flex h-[80px] items-center gap-3 border-b border-border bg-card px-4 py-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn('sm:hidden', skillBtnCls)}
                    aria-label="Back"
                    onClick={onBack}
                >
                    <ArrowLeftIcon size={17} aria-hidden="true" />
                </Button>
                <div
                    className={cn(
                        'flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-primary text-primary-foreground',
                    )}
                >
                    <PlusIcon size={22} aria-hidden="true" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="truncate text-lg font-medium tracking-[-0.03em] text-(--text-primary)">
                        Write skill instructions
                    </h3>
                    <span className="truncate text-sm text-text-secondary">Create a skill manually</span>
                </div>
                <Button variant="ghost" size="icon" className={btnCls} aria-label="Close" onClick={onClose}>
                    <XIcon size={17} aria-hidden="true" />
                </Button>
            </div>

            <div className="modal-agent-content scrollbar-controller scrollbar-vertical flex-1 px-4 py-6">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void form.handleSubmit();
                    }}
                    className={cn('skills-picker-form flex flex-col gap-5', pickerFormWrapCls)}
                >
                    <form.Field
                        name="name"
                        validators={{
                            onChange: ({ value }) => (!value.trim() ? 'Skill name is required' : undefined),
                        }}
                    >
                        {(field) => (
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="skillName" className="text-sm font-medium text-text-secondary">
                                    Skill name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="skillName"
                                    placeholder="weekly-status-report"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    className="h-10"
                                />
                                {field.state.meta.errors.length > 0 ? (
                                    <span className="text-xs text-destructive">
                                        {field.state.meta.errors.join(', ')}
                                    </span>
                                ) : null}
                            </div>
                        )}
                    </form.Field>

                    <form.Field
                        name="description"
                        validators={{
                            onChange: ({ value }) =>
                                value.length > 1024 ? 'Description must be 1024 characters or less.' : undefined,
                        }}
                    >
                        {(field) => (
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="skillDescription" className="text-sm font-medium text-text-secondary">
                                    Description
                                </Label>
                                <TextareaRoot
                                    id="skillDescription"
                                    placeholder="Generate weekly status reports from recent work. Use when asked for updates or progress summaries."
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    className="scrollbar-controller scrollbar-vertical max-h-[100px] min-h-[60px] w-full rounded-md p-2 text-sm"
                                />
                                {field.state.meta.errors.length > 0 ? (
                                    <span className="text-xs text-destructive">
                                        {field.state.meta.errors.join(', ')}
                                    </span>
                                ) : null}
                            </div>
                        )}
                    </form.Field>

                    <form.Field
                        name="body"
                        validators={{
                            onChange: ({ value }) => (!value.trim() ? 'Instructions are required' : undefined),
                        }}
                    >
                        {(field) => (
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-sm font-medium text-text-secondary">
                                    Instructions <span className="text-destructive">*</span>
                                </Label>
                                <div className="overflow-hidden rounded-xl border border-border-secondary bg-background transition-colors focus-within:border-primary">
                                    <InstructionsEditor
                                        value={field.state.value}
                                        onChange={(val) => field.handleChange(val)}
                                        placeholder="Summarize my recent work in three sections: wins, blockers, and next steps. Keep the tone professional but not stiff..."
                                        enableMentions={false}
                                        className="h-full rounded-none border-0 bg-transparent"
                                        contentClassName="h-full"
                                        editorClassName="h-full outline-none text-sm scrollbar-controller scrollbar-vertical p-2! max-h-[180px]"
                                    />
                                </div>
                                {field.state.meta.errors.length > 0 ? (
                                    <span className="text-xs text-destructive">
                                        {field.state.meta.errors.join(', ')}
                                    </span>
                                ) : null}
                            </div>
                        )}
                    </form.Field>
                </form>
            </div>

            <div className="modal-agent-footer sticky bottom-0 z-1 mt-auto border-t border-border bg-card p-4">
                <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                    {([canSubmit, isSubmitting]) => (
                        <div className={pickerFormWrapCls}>
                            <Button
                                className={cn(
                                    'h-12 w-full justify-center rounded-2xl text-sm font-semibold',
                                    'shadow-[0_14px_34px_color-mix(in_srgb,var(--primary)_22%,transparent)]',
                                    'disabled:shadow-none',
                                )}
                                disabled={!canSubmit || isSubmitting || createSkillMutation.isPending}
                                onClick={() => void form.handleSubmit()}
                            >
                                {isSubmitting || createSkillMutation.isPending ? 'Creating...' : 'Create skill'}
                            </Button>
                        </div>
                    )}
                </form.Subscribe>
            </div>
        </div>
    );
};

export default AddSkillPanel;
