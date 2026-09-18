import { Trash2Icon } from 'lucide-react';

import {
    AlertDialog,
    AlertDialogAction,
    AlertDialogCancel,
    AlertDialogContent,
    AlertDialogDescription,
    AlertDialogFooter,
    AlertDialogHeader,
    AlertDialogMedia,
    AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { cn } from '@/lib/utils';

interface RemoveItemDialogProps {
    open: boolean;
    itemName?: string;
    itemType?: string;
    onCancel: () => void;
    onConfirm: () => void;
}

const RemoveItemDialog = ({ open, itemName, itemType = 'skill', onCancel, onConfirm }: RemoveItemDialogProps) => {
    const displayName = itemName?.trim() || `this ${itemType}`;

    const handleOpenChange = (next: boolean) => {
        if (!next) onCancel();
    };

    return (
        <AlertDialog open={open} onOpenChange={handleOpenChange}>
            <AlertDialogContent size="sm" className="data-[size=sm]:max-w-lg">
                <AlertDialogHeader
                    className={cn(
                        'place-items-center p-6 text-center',
                        'has-data-[slot=alert-dialog-media]:grid-rows-[auto_auto_1fr]',
                        'has-data-[slot=alert-dialog-media]:gap-x-0',
                    )}
                >
                    <AlertDialogMedia
                        className={cn('mx-auto mb-2 bg-destructive/10 text-destructive', 'sm:row-span-1')}
                    >
                        <Trash2Icon aria-hidden="true" />
                    </AlertDialogMedia>
                    <AlertDialogTitle className="col-start-auto">Remove {itemType}</AlertDialogTitle>
                    <AlertDialogDescription asChild>
                        <div className="space-y-1 text-center text-sm text-muted-foreground">
                            <p>
                                Are you sure you want to remove{' '}
                                <span
                                    className="inline-flex max-w-full font-medium text-foreground"
                                    title={displayName}
                                >
                                    <span>
                                        &ldquo;
                                        {displayName}
                                        &rdquo;
                                    </span>
                                </span>{' '}
                                from this agent?
                            </p>
                            <p>This action cannot be undone.</p>
                        </div>
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter className="py-6">
                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                    <AlertDialogAction
                        variant="default"
                        className="border-destructive bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        onClick={onConfirm}
                    >
                        Remove
                    </AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>
    );
};

export default RemoveItemDialog;
