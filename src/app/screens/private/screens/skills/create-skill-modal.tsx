import { useForm } from '@tanstack/react-form';
import { XIcon } from 'lucide-react';

import { InstructionsEditor } from '@/components/instructions-editor';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogBody,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { TextareaRoot } from '@/components/ui/textarea-form';
import { useCreateSkillMutation } from '@/lib/api/common/skills';
import { cn } from '@/lib/utils';
import { showErrorToast, showSuccessToast } from '@/utils';
import { shouldEscapeKeepDialogOpen } from '@/utils/escape-cancels-edit';

interface CreateSkillModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSuccess?: (skillId: string) => void;
}

export const CreateSkillModal = ({ open, onOpenChange, onSuccess }: CreateSkillModalProps) => {
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
                onOpenChange(false);
                if (response?._id && onSuccess) {
                    onSuccess(response._id);
                }
                form.reset();
            } catch {
                showErrorToast('Failed to create skill.');
            }
        },
    });

    const handleOpenChange = (isOpen: boolean) => {
        if (!isOpen) {
            form.reset();
        }
        onOpenChange(isOpen);
    };

    return (
        <Dialog open={open} onOpenChange={handleOpenChange}>
            <DialogContent
                className="flex max-h-[85vh] max-w-[700px] flex-col gap-0 overflow-hidden rounded-2xl p-0"
                onEscapeKeyDown={(event) => {
                    if (shouldEscapeKeepDialogOpen(event)) {
                        event.preventDefault();
                    }
                }}
            >
                <DialogHeader className="flex-row items-start justify-between gap-3 px-6 py-5">
                    <div className="flex min-w-0 flex-col gap-1.5">
                        <DialogTitle>Write skill instructions</DialogTitle>
                        <DialogDescription>
                            Define reusable instructions agents can follow when performing a specific task.
                        </DialogDescription>
                    </div>
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 rounded-full text-primary hover:bg-primary/10"
                        aria-label="Close"
                        onClick={() => handleOpenChange(false)}
                    >
                        <XIcon aria-hidden="true" />
                    </Button>
                </DialogHeader>

                <form
                    className="flex min-h-0 flex-1 flex-col"
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void form.handleSubmit();
                    }}
                >
                    <DialogBody className="scrollbar-controller scrollbar-vertical flex min-h-0 flex-1 flex-col gap-5 px-6 py-5">
                        <form.Field
                            name="name"
                            validators={{
                                onChange: ({ value }) => (!value.trim() ? 'Skill name is required' : undefined),
                            }}
                        >
                            {(field) => (
                                <div className="flex flex-col gap-1.5">
                                    <Label htmlFor="skillName" className="text-sm text-text-secondary">
                                        Skill name <span className="text-destructive">*</span>
                                    </Label>
                                    <Input
                                        id="skillName"
                                        placeholder="weekly-status-report"
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        isErrored={field.state.meta.errors.length > 0}
                                        className="h-10"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Use a short, unique identifier with lowercase letters and hyphens.
                                    </p>
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
                                    <div className="flex items-center justify-between gap-2">
                                        <Label htmlFor="skillDescription" className="text-sm text-text-secondary">
                                            Description
                                        </Label>
                                        <span className="text-xs text-muted-foreground">
                                            {field.state.value.length}
                                            /1024
                                        </span>
                                    </div>
                                    <TextareaRoot
                                        id="skillDescription"
                                        placeholder="Generate weekly status reports from recent work. Use when asked for updates or progress summaries."
                                        value={field.state.value}
                                        onChange={(e) => field.handleChange(e.target.value)}
                                        aria-invalid={field.state.meta.errors.length > 0 ? 'true' : undefined}
                                        className="min-h-[88px] resize-y text-sm"
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Briefly explain when agents should use this skill.
                                    </p>
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
                                    <Label className="text-sm text-text-secondary">
                                        Instructions <span className="text-destructive">*</span>
                                    </Label>
                                    <div
                                        className={cn(
                                            'min-h-[280px] overflow-hidden rounded-md border border-border-secondary bg-card',
                                            'transition-colors focus-within:border-primary',
                                            field.state.meta.errors.length > 0 && 'border-destructive',
                                        )}
                                    >
                                        <InstructionsEditor
                                            value={field.state.value}
                                            onChange={(val) => field.handleChange(val)}
                                            placeholder="Summarize my recent work in three sections: wins, blockers, and next steps. Keep the tone professional but not stiff..."
                                            enableMentions={false}
                                            className="h-full min-h-[280px] rounded-none border-0 bg-transparent"
                                            contentClassName="h-full min-h-[280px]"
                                            editorClassName="h-full min-h-[280px] scrollbar-controller scrollbar-vertical px-4 py-3 text-sm outline-none"
                                        />
                                    </div>
                                    <p className="text-xs text-muted-foreground">
                                        Write clear, step-by-step guidance for how the agent should complete the task.
                                    </p>
                                    {field.state.meta.errors.length > 0 ? (
                                        <span className="text-xs text-destructive">
                                            {field.state.meta.errors.join(', ')}
                                        </span>
                                    ) : null}
                                </div>
                            )}
                        </form.Field>
                    </DialogBody>

                    <DialogFooter className="justify-end gap-2 border-t border-border px-6 py-4">
                        <Button type="button" variant="secondary" size="sm" onClick={() => handleOpenChange(false)}>
                            Cancel
                        </Button>
                        <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                            {([canSubmit, isSubmitting]) => (
                                <Button
                                    type="submit"
                                    size="sm"
                                    disabled={!canSubmit || isSubmitting || createSkillMutation.isPending}
                                >
                                    {isSubmitting || createSkillMutation.isPending ? 'Creating...' : 'Create'}
                                </Button>
                            )}
                        </form.Subscribe>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};
