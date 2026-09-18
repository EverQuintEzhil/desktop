import { XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

import ShortcutsPanel from './shortcuts-panel';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const ShortcutsDialog = ({ open, onOpenChange }: Props) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="gap-0 p-0 sm:max-w-md">
            <DialogHeader className="flex-row items-center justify-between">
                <DialogTitle>Keyboard shortcuts</DialogTitle>
                <DialogDescription className="sr-only">
                    Enable, disable, or rebind keyboard shortcuts.
                </DialogDescription>
                <DialogClose asChild>
                    <Button type="button" variant="ghost" size="icon-sm" aria-label="Close">
                        <XIcon />
                    </Button>
                </DialogClose>
            </DialogHeader>
            <div className="px-4 pb-4">
                <ShortcutsPanel scrollClassName="max-h-[60vh] scrollbar-controller scrollbar-vertical" />
            </div>
        </DialogContent>
    </Dialog>
);

export default ShortcutsDialog;
