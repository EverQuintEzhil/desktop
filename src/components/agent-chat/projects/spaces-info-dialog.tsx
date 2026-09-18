import { XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const SpacesInfoDialog = ({ open, onOpenChange }: Props) => {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-w-[500px]">
                <DialogHeader className="flex flex-row items-center justify-between">
                    <DialogTitle>What are Spaces?</DialogTitle>
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
                    <p className="text-sm leading-relaxed text-text-secondary">
                        Spaces are dedicated workspaces that allow you to organize your chats, instructions, and files
                        into a single context. This makes it easier to focus on specific tasks, keep related resources
                        together, and collaborate effectively with your team.
                    </p>
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
};

export default SpacesInfoDialog;
