import { cva, type VariantProps } from 'class-variance-authority';
import { Slot } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

import './button.scss';

const buttonBase =
    'inline-flex items-center justify-between gap-2 whitespace-nowrap rounded-md cursor-pointer ' +
    'text-md font-medium transition-all disabled:pointer-events-none disabled:opacity-50 ' +
    '[&_svg]:pointer-events-none [&_i]:pointer-events-none ' +
    "[&_svg:not([class*='size-'])]:size-4 [&_i:not([class*='size-'])]:size-4 " +
    'shrink-0 [&_svg]:shrink-0 [&_i]:shrink-0 ' +
    '[&_svg]:text-inherit [&_i]:text-inherit ' +
    'outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-(--color-focus-ring) ' +
    'aria-invalid:border-destructive';

const buttonVariants = cva(buttonBase, {
    variants: {
        variant: {
            default: 'border border-primary bg-primary text-primary-foreground hover:bg-primary/90',
            destructive: 'bg-transparent text-destructive hover:bg-destructive/10',
            outline:
                'border border-border-secondary bg-background text-primary hover:bg-background/90 hover:text-primary ' +
                'dark:border-input dark:bg-input/30 dark:hover:bg-input/50',
            secondary:
                'border border-secondary bg-secondary text-secondary-foreground hover:border-accent/80 hover:bg-accent/80',
            ghost: 'border border-transparent text-primary hover:bg-primary/10',
            link: 'border border-transparent text-primary underline-offset-4 hover:underline',
            black: 'border border-transparent bg-transparent text-white hover:bg-white-alpha-2 focus-visible:ring-white focus-visible:ring-offset-0 [&_i]:text-white',
        },
        size: {
            default: 'h-9 px-4 py-2 has-[>i]:px-3',
            xs: "h-6 gap-1 rounded-md px-2 text-xs has-[>i]:px-1.5 [&_i:not([class*='size-'])]:size-3 [&_svg:not([class*='size-'])]:size-3",
            sm: 'h-8 gap-1 rounded-md px-2 text-sm has-[>i]:pr-2.5',
            lg: 'h-10 rounded-md px-6 has-[>i]:px-4',
            icon: 'size-9 justify-center',
            'icon-xs':
                "size-6 justify-center rounded-md [&_i:not([class*='size-'])]:size-3 [&_svg:not([class*='size-'])]:size-3",
            'icon-sm': 'size-8 justify-center',
            'icon-lg': 'size-10 justify-center',
        },
    },
    defaultVariants: {
        variant: 'default',
        size: 'default',
    },
});

function Button({
    className,
    variant = 'default',
    size = 'default',
    asChild = false,
    ...props
}: React.ComponentProps<'button'> &
    VariantProps<typeof buttonVariants> & {
        asChild?: boolean;
    }) {
    const Comp = asChild ? Slot.Root : 'button';

    return (
        <Comp
            data-slot="button"
            data-variant={variant}
            data-size={size}
            className={cn(buttonVariants({ variant, size, className }))}
            {...props}
        />
    );
}

export { Button, buttonVariants };
