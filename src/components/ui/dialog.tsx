'use client';

import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as React from 'react';

import { usePortalContainer } from '@/components/ui/portal-container';
import { cn } from '@/lib/utils';

const Dialog = DialogPrimitive.Root;
const DialogTrigger = DialogPrimitive.Trigger;
const DialogPortal = ({ container, ...props }: React.ComponentProps<typeof DialogPrimitive.Portal>) => {
    const scopedContainer = usePortalContainer();

    return <DialogPrimitive.Portal container={container ?? scopedContainer ?? undefined} {...props} />;
};
const DialogClose = DialogPrimitive.Close;

type DialogContentProps = React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
    overlayClassName?: string;
};
type DialogInteractOutsideHandler = NonNullable<DialogContentProps['onInteractOutside']>;

const toastInteractionSelector = '[data-sonner-toaster], [data-sonner-toast], .toaster, .toast-feedback';

const getInteractOutsideTarget = (event: Event): EventTarget | null => {
    const detail = 'detail' in event ? event.detail : null;

    if (!detail || typeof detail !== 'object' || !('originalEvent' in detail)) {
        return event.target;
    }

    const { originalEvent } = detail as { originalEvent?: { target?: EventTarget | null } };

    return originalEvent?.target ?? event.target;
};

const isToastInteraction = (event: Event): boolean => {
    const target = getInteractOutsideTarget(event);

    if (!(target instanceof Element)) {
        return false;
    }

    return Boolean(target.closest(toastInteractionSelector));
};

const DialogOverlay = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Overlay>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Overlay
        ref={ref}
        className={cn(
            'dialog-overlay fixed inset-0 z-50 bg-black/50 duration-150 ease-out data-[state=closed]:animate-out data-[state=open]:animate-in',
            'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
            className,
        )}
        {...props}
    />
));

DialogOverlay.displayName = DialogPrimitive.Overlay.displayName;

const DialogContent = React.forwardRef<React.ComponentRef<typeof DialogPrimitive.Content>, DialogContentProps>(
    ({ className, children, overlayClassName, onInteractOutside, ...props }, ref) => {
        const handleInteractOutside: DialogInteractOutsideHandler = (event) => {
            onInteractOutside?.(event);

            if (event.defaultPrevented) {
                return;
            }

            if (isToastInteraction(event)) {
                event.preventDefault();
            }
        };

        return (
            <DialogPortal>
                <DialogOverlay className={overlayClassName} />
                <DialogPrimitive.Content
                    ref={ref}
                    className={cn(
                        'dialog-block fixed top-[50%] left-[50%] z-51 grid w-full max-w-[calc(100%-2rem)] translate-x-[-50%] translate-y-[-50%]',
                        'bg-card shadow-(--shadow-sm)',
                        'duration-400 ease-out data-[state=closed]:animate-out data-[state=open]:animate-in',
                        'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                        'data-[state=closed]:slide-out-to-bottom-3 data-[state=open]:slide-in-from-bottom-3',
                        'rounded-lg outline-none',
                        className,
                    )}
                    onInteractOutside={handleInteractOutside}
                    {...props}
                >
                    {children}
                </DialogPrimitive.Content>
            </DialogPortal>
        );
    },
);

DialogContent.displayName = DialogPrimitive.Content.displayName;

const DialogHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            'dialog-header flex shrink-0 flex-col gap-1.5 px-4 py-3 text-left',
            'border-b border-border',
            className,
        )}
        {...props}
    />
);

DialogHeader.displayName = 'DialogHeader';

const DialogBody = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div className={cn('dialog-body px-4 py-8', className)} {...props} />
);

DialogBody.displayName = 'DialogBody';

const DialogFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
    <div
        className={cn(
            'dialog-footer flex shrink-0 flex-wrap items-center justify-between gap-2 px-4 py-3 max-sm:items-end',
            className,
        )}
        {...props}
    />
);

DialogFooter.displayName = 'DialogFooter';

const DialogTitle = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Title>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Title ref={ref} className={cn('text-lg leading-none font-medium', className)} {...props} />
));

DialogTitle.displayName = DialogPrimitive.Title.displayName;

const DialogDescription = React.forwardRef<
    React.ComponentRef<typeof DialogPrimitive.Description>,
    React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
    <DialogPrimitive.Description ref={ref} className={cn('text-sm text-muted-foreground', className)} {...props} />
));

DialogDescription.displayName = DialogPrimitive.Description.displayName;

export {
    Dialog,
    DialogPortal,
    DialogOverlay,
    DialogTrigger,
    DialogContent,
    DialogHeader,
    DialogBody,
    DialogFooter,
    DialogTitle,
    DialogDescription,
    DialogClose,
};
