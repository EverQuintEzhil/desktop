import { PencilIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';

import { InstructionsEditor } from '@/components/instructions-editor';
import { CARD_PROSE_CLASS_NAME } from '@/components/markdown';
import Markdown from '@/components/markdown/markdown';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import Spinner from '@/components/ui/spinner';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import { showErrorToast } from '@/utils';
import { shouldEscapeKeepDialogOpen } from '@/utils/escape-cancels-edit';

interface Props {
    instructions: string;
    canEdit: boolean;
    onSave: (value: string) => Promise<void>;
}

const SpaceInstructionsCard = ({ instructions, canEdit, onSave }: Props) => {
    const [isOpen, setIsOpen] = useState(false);
    const [draft, setDraft] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const hasInstructions = Boolean(instructions.trim());

    const openEditor = () => {
        setDraft(instructions);
        setIsOpen(true);
    };

    const handleSave = async () => {
        const next = draft.trim();

        if (next === instructions.trim()) {
            setIsOpen(false);

            return;
        }

        setIsSaving(true);
        try {
            await onSave(next);
            setIsOpen(false);
        } catch {
            showErrorToast('Failed to update instructions');
        } finally {
            setIsSaving(false);
        }
    };

    const renderContent = () => {
        if (hasInstructions) {
            return (
                <div
                    className={cn(
                        'space-instructions-card-content-markdown scrollbar-controller scrollbar-vertical p-4 text-sm text-text-secondary lg:max-h-48',
                        CARD_PROSE_CLASS_NAME,
                    )}
                >
                    <Markdown>{instructions}</Markdown>
                </div>
            );
        }

        if (canEdit) {
            return (
                <button
                    type="button"
                    onClick={openEditor}
                    className="w-full cursor-text p-4 text-left text-sm leading-6 text-muted-foreground"
                >
                    Add instructions to tailor responses in this space
                </button>
            );
        }

        return <p className="p-4 text-sm leading-6 text-muted-foreground">No instructions added for this space</p>;
    };

    return (
        <div className="space-instructions-card flex flex-col gap-2">
            <div className="space-instructions-card-header flex h-6 items-center justify-between gap-2 px-1">
                <span className="text-sm font-medium text-foreground">Instructions</span>
                {canEdit ? (
                    <Tooltip>
                        <TooltipTrigger asChild>
                            <Button
                                variant="ghost"
                                size="icon-xs"
                                className="shrink-0 rounded-md"
                                aria-label={hasInstructions ? 'Edit instructions' : 'Add instructions'}
                                onClick={openEditor}
                            >
                                {hasInstructions ? (
                                    <PencilIcon className="size-3.5" />
                                ) : (
                                    <PlusIcon className="size-4" />
                                )}
                            </Button>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">
                            {hasInstructions ? 'Edit instructions' : 'Add instructions'}
                        </TooltipContent>
                    </Tooltip>
                ) : null}
            </div>
            <div className="space-instructions-card-content overflow-hidden rounded-2xl border border-border-secondary bg-card">
                {renderContent()}
            </div>

            <Dialog
                open={isOpen}
                onOpenChange={(open) => {
                    if (!open) setIsOpen(false);
                }}
            >
                <DialogContent
                    className="max-w-[640px]"
                    onEscapeKeyDown={(event) => {
                        if (shouldEscapeKeepDialogOpen(event)) {
                            event.preventDefault();
                        }
                    }}
                >
                    <DialogHeader>
                        <DialogTitle>Set project instructions</DialogTitle>
                    </DialogHeader>
                    <DialogBody className="flex flex-col gap-3 py-4">
                        <p className="text-sm leading-6 text-text-secondary">
                            Provide relevant instructions and information for chats within this space. This works
                            alongside your profile instructions and the selected style in a chat.
                        </p>
                        <div className="flex h-[40svh] min-h-[280px] flex-col overflow-hidden rounded-md border border-border-secondary">
                            <InstructionsEditor
                                value={draft}
                                onChange={setDraft}
                                placeholder="Think step by step and show reasoning for complex problems. Use specific examples."
                                enableMentions={false}
                                className="flex h-full flex-col"
                                contentClassName="h-full flex flex-col min-h-0"
                                editorClassName="h-full scrollbar-controller scrollbar-vertical px-4 py-3 text-h5"
                            />
                        </div>
                    </DialogBody>
                    <DialogFooter className="justify-end">
                        <Button variant="secondary" size="sm" disabled={isSaving} onClick={() => setIsOpen(false)}>
                            Cancel
                        </Button>
                        <Button size="sm" disabled={isSaving} onClick={handleSave}>
                            {isSaving ? <Spinner className="size-4" /> : null}
                            Save instructions
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default SpaceInstructionsCard;
