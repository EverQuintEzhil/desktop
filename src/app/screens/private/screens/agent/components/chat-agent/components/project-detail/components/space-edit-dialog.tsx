import { XIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { InstructionsEditor } from '@/components/instructions-editor';
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
import Spinner from '@/components/ui/spinner';
import { showErrorToast } from '@/utils';
import { shouldEscapeKeepDialogOpen } from '@/utils/escape-cancels-edit';

export interface SpaceEditValues {
    name: string;
    description: string;
    instructions: string;
    /** Desktop-only: absolute local folder for space-scoped coding tools; '' means unset. */
    folderPath: string;
}

interface Props {
    open: boolean;
    initial: SpaceEditValues | null;
    onOpenChange: (open: boolean) => void;
    onSave: (patch: Partial<SpaceEditValues>) => Promise<void>;
}

const SpaceEditDialog = ({ open, initial, onOpenChange, onSave }: Props) => {
    const [name, setName] = useState('');
    const [description, setDescription] = useState('');
    const [instructions, setInstructions] = useState('');
    const [folderPath, setFolderPath] = useState('');
    const [isSaving, setIsSaving] = useState(false);

    const initialRef = useRef(initial);
    const seedRef = useRef<SpaceEditValues | null>(null);

    initialRef.current = initial;

    // Seeded once per opening, deliberately not keyed on `initial`: both call sites build it as an
    // inline object literal, so its identity changes on every parent render and depending on it
    // would overwrite whatever the user has typed on the next background refetch. Call sites must
    // not re-point `initial` at a different record while `open` stays true.
    useEffect(() => {
        if (!open) return;

        const seed = initialRef.current;

        if (!seed) return;

        seedRef.current = seed;
        setName(seed.name);
        setDescription(seed.description);
        setInstructions(seed.instructions);
        setFolderPath(seed.folderPath);
    }, [open]);

    const submit = async () => {
        const seed = seedRef.current;

        if (!seed) return;

        const patch: Partial<SpaceEditValues> = {};
        const trimmedName = name.trim();
        const trimmedDescription = description.trim();
        const trimmedInstructions = instructions.trim();
        const trimmedFolderPath = folderPath.trim();

        // Diffed against the seed, not the live `initial`: an untouched field must never be sent,
        // or a concurrent edit that landed via refetch while this dialog was open gets reverted.
        if (trimmedName && trimmedName !== seed.name) patch.name = trimmedName;
        if (trimmedDescription !== seed.description) patch.description = trimmedDescription;
        if (trimmedInstructions !== seed.instructions) patch.instructions = trimmedInstructions;
        if (trimmedFolderPath !== seed.folderPath) patch.folderPath = trimmedFolderPath;

        if (Object.keys(patch).length === 0) {
            onOpenChange(false);

            return;
        }

        setIsSaving(true);
        try {
            await onSave(patch);
            onOpenChange(false);
        } catch {
            showErrorToast('Failed to update space');
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(next) => {
                if (!next && !isSaving) onOpenChange(false);
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
                    <DialogTitle>Edit space</DialogTitle>
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
                        <label className="text-sm font-medium" htmlFor="space-edit-name">
                            Name <span className="text-destructive">*</span>
                        </label>
                        <Input
                            id="space-edit-name"
                            autoFocus
                            value={name}
                            onChange={(e) => setName(e.currentTarget.value)}
                            onEnter={submit}
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium" htmlFor="space-edit-description">
                            Description
                        </label>
                        <textarea
                            id="space-edit-description"
                            value={description}
                            placeholder="What is this space about?"
                            onChange={(e) => setDescription(e.currentTarget.value)}
                            className="min-h-20 w-full resize-none rounded-md border border-border-secondary bg-transparent px-3 py-2 text-sm outline-none focus:border-primary"
                        />
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium" htmlFor="space-edit-folder-path">
                            Local folder path
                        </label>
                        <Input
                            id="space-edit-folder-path"
                            value={folderPath}
                            placeholder="/Users/you/code/my-project"
                            onChange={(e) => setFolderPath(e.currentTarget.value)}
                            onEnter={submit}
                            className="font-mono"
                        />
                        <span className="text-xs text-muted-foreground">
                            Absolute path on this computer. When set, chats in this space can use local coding tools
                            rooted here. Leave empty to disable them.
                        </span>
                    </div>
                    <div className="flex flex-col gap-1.5">
                        <label className="text-sm font-medium" htmlFor="space-edit-instructions">
                            Instructions
                        </label>
                        <div className="flex h-[40svh] min-h-[300px] flex-col overflow-hidden rounded-md border border-border-secondary">
                            <InstructionsEditor
                                value={instructions}
                                onChange={setInstructions}
                                placeholder="Think step by step and show reasoning for complex problems. Use specific examples."
                                enableMentions={false}
                                className="flex h-full flex-col"
                                contentClassName="h-full flex flex-col min-h-0"
                                editorClassName="h-full scrollbar-controller scrollbar-vertical px-4 py-3 text-h5"
                            />
                        </div>
                    </div>
                </DialogBody>
                <DialogFooter className="justify-end">
                    <Button size="sm" disabled={!name.trim() || isSaving} onClick={submit}>
                        {isSaving ? <Spinner className="size-4" /> : null}
                        Save
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default SpaceEditDialog;
