import { XIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import type { RoutineType } from '@/types/routines';
import { shouldEscapeKeepDialogOpen } from '@/utils/escape-cancels-edit';

import RoutineFormBody from './components/routine-form-body';

interface RoutineFormModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** Present = edit mode; absent = create mode. */
    routine?: RoutineType | null;
    /** Present = the page is scoped to this agent, so the routine belongs to it and the field is dropped. */
    agent?: { _id: string; name: string };
    /** Present = opened from a space, so that space is pre-selected. */
    project?: { _id: string; name: string };
}

export const RoutineFormModal = ({ open, onOpenChange, routine, agent, project }: RoutineFormModalProps) => {
    const isEdit = Boolean(routine);
    const close = () => onOpenChange(false);

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent
                aria-describedby={undefined}
                // The Instructions editor flags itself while its "@" menu is open; Escape then closes only the menu.
                onEscapeKeyDown={(event) => {
                    if (shouldEscapeKeepDialogOpen(event)) event.preventDefault();
                }}
                className="flex max-h-[85vh] max-w-[min(640px,calc(100%-2rem))] flex-col gap-0 overflow-hidden rounded-2xl p-0"
            >
                <DialogHeader className="flex-row items-center justify-between gap-3 px-6 py-4">
                    <DialogTitle>{isEdit ? 'Edit routine' : 'New routine'}</DialogTitle>
                    <DialogClose asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 rounded-full text-(--text-secondary) hover:bg-accent hover:text-(--text-primary)"
                        >
                            <XIcon aria-hidden="true" />
                            <span className="sr-only">Close</span>
                        </Button>
                    </DialogClose>
                </DialogHeader>

                <RoutineFormBody routine={routine} agent={agent} project={project} onClose={close} />
            </DialogContent>
        </Dialog>
    );
};
