import { useEffect, useState } from 'react';

import { InstructionsEditor } from '@/components/instructions-editor';
import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { shouldEscapeKeepDialogOpen } from '@/utils/escape-cancels-edit';

interface Props {
    isOpen: boolean;
    projectName: string;
    initialValue: string;
    onClose: () => void;
    onSave: (instructions: string) => void;
}

const ProjectInstructionsModal = (props: Props) => {
    const { isOpen, projectName, initialValue, onClose, onSave } = props;
    const [value, setValue] = useState(initialValue);

    useEffect(() => {
        if (isOpen) setValue(initialValue);
    }, [isOpen, initialValue]);

    const handleSave = () => {
        onSave(value.trim());
        onClose();
    };

    return (
        <Dialog
            open={isOpen}
            onOpenChange={(open) => {
                if (!open) onClose();
            }}
        >
            <DialogContent
                className="max-w-[820px]"
                onEscapeKeyDown={(event) => {
                    if (shouldEscapeKeepDialogOpen(event)) {
                        event.preventDefault();
                    }
                }}
            >
                <DialogHeader>
                    <DialogTitle>Set space instructions</DialogTitle>
                </DialogHeader>
                <DialogBody className="flex flex-col gap-4 py-4">
                    <p className="text-sm text-text-secondary">
                        Provide relevant instructions and information for chats within{' '}
                        <span className="font-medium text-foreground">{projectName}</span>. These work alongside your
                        profile instructions and the selected style in a chat.
                    </p>
                    <div className="h-[60svh] min-h-[360px] overflow-hidden rounded-md border border-border-secondary">
                        <InstructionsEditor
                            value={value}
                            onChange={setValue}
                            placeholder="Think step by step and show reasoning for complex problems. Use specific examples."
                            enableMentions={false}
                            autoFocus
                            className="h-full"
                            contentClassName="h-full"
                            editorClassName="scrollbar-controller scrollbar-vertical px-4 py-3 text-h5"
                        />
                    </div>
                </DialogBody>
                <DialogFooter className="justify-end">
                    <Button variant="secondary" size="sm" onClick={onClose}>
                        Cancel
                    </Button>
                    <Button size="sm" onClick={handleSave}>
                        Save instructions
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default ProjectInstructionsModal;
