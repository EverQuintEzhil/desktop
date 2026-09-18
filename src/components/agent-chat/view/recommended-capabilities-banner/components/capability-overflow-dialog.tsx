import { X as XIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

interface Props {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: string;
    description: string;
    children: ReactNode;
}

const CapabilityOverflowDialog = ({ isOpen, onOpenChange, title, description, children }: Props) => {
    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onOpenChange}>
            <DialogContent className="rounded-2xl sm:max-w-[440px]">
                <DialogHeader className="flex flex-row items-start justify-between gap-4">
                    <div className="flex min-w-0 flex-col gap-1">
                        <DialogTitle className="text-base">{title}</DialogTitle>
                        <DialogDescription className="text-xs text-muted-foreground">{description}</DialogDescription>
                    </div>
                    <DialogClose
                        aria-label="Close"
                        className="-mr-1 shrink-0 cursor-pointer rounded-sm p-1 opacity-70 transition-opacity hover:opacity-100"
                    >
                        <XIcon className="size-4" />
                    </DialogClose>
                </DialogHeader>
                <div className="scrollbar-vertical scrollbar-controller flex max-h-[320px] flex-col px-4 pt-2 pb-3">
                    {children}
                </div>
            </DialogContent>
        </Dialog>
    );
};

export default CapabilityOverflowDialog;
