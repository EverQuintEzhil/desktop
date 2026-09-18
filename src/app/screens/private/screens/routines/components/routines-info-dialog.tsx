import { XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface Props {
    open: boolean;
    onOpenChange: (open: boolean) => void;
}

const RoutinesInfoDialog = ({ open, onOpenChange }: Props) => (
    <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-[500px]">
            <DialogHeader className="flex flex-row items-center justify-between">
                <DialogTitle>What are Routines?</DialogTitle>
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
                    Routines run research for you on their own and write up what they find. Give one a prompt and a
                    schedule — daily, weekly, once, or only when you start it by hand — and every run arrives as a chat
                    you can read, with the report emailed to you if you want it. Point a routine at a Space and everyone
                    on that Space sees the reports, not just you.
                </p>
            </DialogBody>
        </DialogContent>
    </Dialog>
);

export default RoutinesInfoDialog;
