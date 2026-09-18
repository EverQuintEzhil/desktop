import { useQueryClient } from '@tanstack/react-query';
import { XIcon } from 'lucide-react';
import { useState } from 'react';

import { useChatHost } from '@/components/chat-host';
import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogBody,
    DialogClose,
    DialogContent,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { appProjectsApi } from '@/lib/api/app/projects';
import { mapProject, type ProjectType } from '@/types/project';
import { showErrorToast } from '@/utils';
import { shouldEscapeKeepDialogOpen } from '@/utils/escape-cancels-edit';

interface Props {
    agentId: string;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onCreated?: (project: ProjectType) => void;
}

const CreateSpaceDialog = ({ agentId, open, onOpenChange, onCreated }: Props) => {
    const { slots } = useChatHost();
    const queryClient = useQueryClient();

    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [instructions, setInstructions] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    const reset = () => {
        setName('');
        setDescription('');
        setInstructions('');
    };

    const close = () => {
        onOpenChange(false);
        reset();
    };

    const handleCreate = async () => {
        const trimmedName = name.trim();

        if (!trimmedName || isCreating) return;

        setIsCreating(true);
        try {
            const created = await appProjectsApi.createProject<unknown>({
                name: trimmedName,
                agentId,
                description: description.trim(),
                instructions: instructions.trim(),
            });

            await queryClient.invalidateQueries({ queryKey: ['projects', agentId] });
            queryClient.invalidateQueries({ queryKey: ['projects-picker', agentId] });

            close();
            onCreated?.(mapProject(created as never));
        } catch {
            showErrorToast('Failed to create space');
        } finally {
            setIsCreating(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next) close();
            }}
        >
            <DialogContent
                className="max-w-[720px]"
                onEscapeKeyDown={(event) => {
                    if (shouldEscapeKeepDialogOpen(event)) {
                        event.preventDefault();
                    }
                }}
            >
                <DialogHeader className="flex flex-row items-center justify-between">
                    <DialogTitle>New space</DialogTitle>
                    <DialogClose asChild>
                        <Button
                            variant="ghost"
                            size="icon"
                            className="-mr-2 size-8 rounded-full opacity-70 transition-opacity hover:opacity-100 focus:outline-none"
                        >
                            <XIcon className="size-4" />
                            <span className="sr-only">Close</span>
                        </Button>
                    </DialogClose>
                </DialogHeader>
                <DialogBody className="flex flex-col gap-4 py-4">
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium" htmlFor="project-name">
                            Name <span className="text-destructive">*</span>
                        </label>
                        <Input
                            id="project-name"
                            autoFocus
                            value={name}
                            placeholder="Space name"
                            onChange={(e) => setName(e.currentTarget.value)}
                            onEnter={handleCreate}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium" htmlFor="project-description">
                            Description
                        </label>
                        <textarea
                            id="project-description"
                            value={description}
                            placeholder="What is this space about?"
                            onChange={(e) => setDescription(e.currentTarget.value)}
                            className="min-h-20 w-full resize-none rounded-md border border-border-secondary bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium" htmlFor="project-instructions">
                            Instructions
                        </label>
                        <div className="flex h-[40svh] min-h-[300px] flex-col overflow-hidden rounded-md border border-border-secondary">
                            {slots?.renderInstructionsEditor?.({
                                value: instructions,
                                onChange: setInstructions,
                                placeholder:
                                    'Think step by step and show reasoning for complex problems. Use specific examples.',
                                enableMentions: false,
                                className: 'h-full flex flex-col',
                                contentClassName: 'h-full flex flex-col min-h-0',
                                editorClassName: 'h-full scrollbar-controller scrollbar-vertical px-4 py-3 text-h5',
                            }) ?? null}
                        </div>
                    </div>
                </DialogBody>
                <DialogFooter className="justify-end">
                    <Button size="sm" disabled={!name.trim() || isCreating} onClick={handleCreate}>
                        {isCreating ? 'Creating…' : 'Create space'}
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default CreateSpaceDialog;
