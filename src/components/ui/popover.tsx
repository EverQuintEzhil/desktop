'use client';

import * as PopoverPrimitive from '@radix-ui/react-popover';
import * as React from 'react';

import { cn } from '@/lib/utils';

const Popover = ({ modal = false, ...props }: React.ComponentProps<typeof PopoverPrimitive.Root>) => (
    <PopoverPrimitive.Root modal={modal} {...props} />
);
const PopoverTrigger = PopoverPrimitive.Trigger;
const PopoverAnchor = PopoverPrimitive.Anchor;
const PopoverClose = PopoverPrimitive.Close;

const PopoverContent = React.forwardRef<
    React.ComponentRef<typeof PopoverPrimitive.Content>,
    React.ComponentPropsWithoutRef<typeof PopoverPrimitive.Content> & {
        /** Render into this node (e.g. Radix Sheet content) so nested scroll lock allows wheel on the list. */
        container?: HTMLElement | null;
    }
>(({ className, align = 'center', sideOffset = 4, container, ...props }, ref) => (
    <PopoverPrimitive.Portal container={container ?? undefined}>
        <PopoverPrimitive.Content
            ref={ref}
            align={align}
            sideOffset={sideOffset}
            className={cn(
                'z-51 w-max max-w-xs min-w-[220px] rounded-xl border bg-popover p-0 text-popover-foreground shadow-surface dark:border-(--neutral-border)',
                'outline-none data-[state=closed]:animate-out data-[state=open]:animate-in',
                'data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
                'data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95',
                'data-[side=bottom]:slide-in-from-top-2 data-[side=left]:slide-in-from-right-2',
                'data-[side=right]:slide-in-from-left-2 data-[side=top]:slide-in-from-bottom-2',
                className,
            )}
            {...props}
        />
    </PopoverPrimitive.Portal>
));

PopoverContent.displayName = PopoverPrimitive.Content.displayName;

export { Popover, PopoverTrigger, PopoverContent, PopoverAnchor, PopoverClose };
