import * as React from 'react';

import { cn } from '@/lib/utils';

export interface InputProps extends React.ComponentProps<'input'> {
    onEnter?: (value: string) => void;
    styles?: string;
    isErrored?: boolean;
}

function Input({ className, type, onEnter, styles, isErrored, onKeyDown, onWheel, ...props }: InputProps) {
    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if (e.key === 'Enter' && onEnter) {
            onEnter(e.currentTarget.value);
        }
        if (onKeyDown) {
            onKeyDown(e);
        }
    };

    const handleWheel = (e: React.WheelEvent<HTMLInputElement>) => {
        e.currentTarget.blur();
        if (onWheel) {
            onWheel(e);
        }
    };

    return (
        <input
            type={type}
            data-slot="input"
            autoComplete="off"
            aria-invalid={isErrored ? 'true' : undefined}
            className={cn(
                'rounded-md bg-card text-(--text-primary) file:text-foreground',
                'selection:bg-primary selection:text-primary-foreground placeholder:text-muted-foreground',
                'appearance-none [&::-webkit-inner-spin-button]:appearance-none',
                '[-moz-appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none',
                'h-8 w-full min-w-0 border border-border-secondary px-2 py-1 text-base dark:bg-input/30',
                'transition-[color,box-shadow] outline-none',
                'file:inline-flex file:h-7 file:border-0 file:bg-transparent file:text-sm file:font-medium',
                'disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-50 md:text-sm',
                'focus:border-primary focus-visible:ring-0 focus-visible:ring-(--color-focus-ring) focus-visible:outline-none',
                'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
                styles,
                className,
            )}
            onKeyDown={handleKeyDown}
            onWheel={handleWheel}
            {...props}
        />
    );
}

export { Input };
