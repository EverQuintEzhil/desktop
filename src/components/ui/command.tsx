'use client';

import { Command as CommandPrimitive } from 'cmdk';
import * as React from 'react';

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

import './command.scss';

function Command({ className, ...props }: React.ComponentProps<typeof CommandPrimitive>) {
    return (
        <CommandPrimitive
            data-slot="command"
            className={cn(
                'command-block scrollbar-vertical scrollbar-controller flex h-full max-h-[205px] w-full flex-col rounded-xl bg-popover p-2 text-popover-foreground',
                className,
            )}
            {...props}
        />
    );
}

function CommandDialog({
    title = 'Command Palette',
    description = 'Search for a command to run...',
    children,
    className,
    shouldFilter,
    ...props
}: React.ComponentProps<typeof Dialog> & {
    title?: string;
    description?: string;
    className?: string;
    shouldFilter?: boolean;
}) {
    return (
        <Dialog {...props}>
            <DialogHeader className="sr-only">
                <DialogTitle>{title}</DialogTitle>
                <DialogDescription>{description}</DialogDescription>
            </DialogHeader>
            <DialogContent className={cn('overflow-hidden p-0', className)}>
                <Command
                    shouldFilter={shouldFilter}
                    className={cn(
                        'flex h-[min(70vh,28rem)] max-h-[min(70vh,28rem)] flex-col p-0',
                        '**:data-[slot=command-input-wrapper]:h-12 **:[[cmdk-group-heading]]:px-2 **:[[cmdk-group-heading]]:text-muted-foreground',
                        '[&_[cmdk-group]:not([hidden])_~[cmdk-group]]:pt-0 **:[[cmdk-group-heading]]:font-medium **:[[cmdk-group]]:px-2',
                        '[&_[cmdk-input-wrapper]_svg]:h-5 [&_[cmdk-input-wrapper]_svg]:w-5 **:[[cmdk-input]]:h-12 **:[[cmdk-item]]:px-2',
                        '[&_[cmdk-item]_svg]:h-5 [&_[cmdk-item]_svg]:w-5 **:[[cmdk-item]]:py-3',
                    )}
                >
                    {children}
                </Command>
            </DialogContent>
        </Dialog>
    );
}

function CommandInput({
    className,
    icon,
    trailing,
    wrapperClassName,
    ...props
}: React.ComponentProps<typeof CommandPrimitive.Input> & {
    icon?: React.ReactNode;
    trailing?: React.ReactNode;
    wrapperClassName?: string;
}) {
    return (
        <div
            data-slot="command-input-wrapper"
            className={cn(
                'sticky top-0 z-10 flex h-8 items-center gap-2 rounded-sm border border-border-secondary bg-popover px-2 transition-colors focus-within:border-primary',
                wrapperClassName,
            )}
        >
            {icon}
            <CommandPrimitive.Input
                data-slot="command-input"
                className={cn(
                    'flex h-9 w-full rounded-md bg-transparent py-3 text-sm outline-hidden placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50',
                    className,
                )}
                {...props}
            />
            {trailing}
        </div>
    );
}

function CommandFooter({ className, ...props }: React.ComponentProps<'div'>) {
    return (
        <div
            data-slot="command-footer"
            className={cn(
                'flex items-center gap-4 border-t border-border px-3 py-2 text-xs text-muted-foreground',
                className,
            )}
            {...props}
        />
    );
}

function CommandList({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.List>) {
    return <CommandPrimitive.List data-slot="command-list" className={cn('command-list', className)} {...props} />;
}

function CommandEmpty({ ...props }: React.ComponentProps<typeof CommandPrimitive.Empty>) {
    return <CommandPrimitive.Empty data-slot="command-empty" className="py-6 text-center text-sm" {...props} />;
}

function CommandGroup({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Group>) {
    return (
        <CommandPrimitive.Group
            data-slot="command-group"
            className={cn(
                'overflow-hidden text-foreground',
                '**:[[cmdk-group-heading]]:text-muted-foreground',
                '**:[[cmdk-group-heading]]:text-xs **:[[cmdk-group-heading]]:font-medium',
                className,
            )}
            {...props}
        />
    );
}

function CommandSeparator({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Separator>) {
    return (
        <CommandPrimitive.Separator
            data-slot="command-separator"
            className={cn('-mx-1 h-px bg-border', className)}
            {...props}
        />
    );
}

function CommandItem({ className, ...props }: React.ComponentProps<typeof CommandPrimitive.Item>) {
    const ref = React.useRef<HTMLDivElement>(null);
    const [isSelected, setIsSelected] = React.useState(false);

    React.useEffect(() => {
        const el = ref.current;

        if (!el) return;

        const sync = () => setIsSelected(el.dataset.selected === 'true');

        sync();

        const observer = new MutationObserver(sync);

        observer.observe(el, { attributes: true, attributeFilter: ['data-selected'] });

        return () => observer.disconnect();
    }, []);

    return (
        <CommandPrimitive.Item
            data-slot="command-item"
            className={cn(
                'command-item cursor-pointer',
                isSelected && 'selected',
                "relative flex items-center gap-2 [&_svg:not([class*='text-'])]:text-muted-foreground",
                'rounded-md p-2 text-sm outline-hidden select-none data-[disabled=true]:pointer-events-none',
                "data-[disabled=true]:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
                className,
            )}
            {...props}
            ref={ref}
        />
    );
}

function CommandShortcut({ className, ...props }: React.ComponentProps<'span'>) {
    return (
        <span
            data-slot="command-shortcut"
            className={cn('ml-auto text-xs tracking-widest text-muted-foreground', className)}
            {...props}
        />
    );
}

export {
    Command,
    CommandDialog,
    CommandInput,
    CommandFooter,
    CommandList,
    CommandEmpty,
    CommandGroup,
    CommandItem,
    CommandShortcut,
    CommandSeparator,
};
