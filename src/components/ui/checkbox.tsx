import { CheckIcon, MinusIcon } from 'lucide-react';
import { Checkbox as CheckboxPrimitive } from 'radix-ui';
import * as React from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

function CheckboxShadcn({ className, ...props }: React.ComponentProps<typeof CheckboxPrimitive.Root>) {
    return (
        <CheckboxPrimitive.Root
            data-slot="checkbox"
            className={cn(
                'peer checkbox-default-border size-4 shrink-0 rounded-sm shadow-xs transition-shadow outline-none dark:bg-input/30',
                'border border-border-secondary',
                'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
                'dark:data-[state=checked]:bg-primary',
                'focus-visible:border-primary focus-visible:outline-none',
                'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
                'disabled:cursor-not-allowed disabled:opacity-50',
                className,
            )}
            {...props}
        >
            <CheckboxPrimitive.Indicator
                data-slot="checkbox-indicator"
                className="grid place-content-center text-current transition-none"
            >
                <CheckIcon className="size-3.5" />
            </CheckboxPrimitive.Indicator>
        </CheckboxPrimitive.Root>
    );
}

export interface CheckboxProps {
    onChange: (value: string | number | readonly string[] | undefined, checked: boolean) => void;
    styles?: string;
    indeterminate?: boolean;
    preventDefault?: boolean;
    label?: string;
    labelClassName?: string;
    isErrored?: boolean;
    color?: 'primary' | 'subtle' | 'danger' | 'accent' | 'white';
}

const Checkbox = React.forwardRef<
    React.ElementRef<typeof CheckboxPrimitive.Root>,
    Omit<React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>, 'onChange'> & Partial<CheckboxProps>
>(
    (
        {
            id: idProp,
            value,
            onChange,
            isErrored,
            indeterminate,
            disabled,
            preventDefault = false,
            className = '',
            label,
            labelClassName,
            styles,
            checked,
            ...rest
        },
        ref,
    ) => {
        const generatedId = React.useId();
        const id = idProp ?? generatedId;

        return (
            <div
                className={`checkbox flex items-center space-x-2 ${isErrored ? 'has-error' : ''}`}
                style={
                    styles
                        ? {
                              ...Object.fromEntries(
                                  styles
                                      .split(';')
                                      .filter(Boolean)
                                      .map((s) => s.split(':').map((x) => x.trim())),
                              ),
                          }
                        : undefined
                }
                onClick={(e) => {
                    if (preventDefault) e.stopPropagation();
                }}
            >
                <CheckboxPrimitive.Root
                    ref={ref}
                    id={id}
                    disabled={disabled}
                    checked={indeterminate ? 'indeterminate' : checked}
                    onCheckedChange={(c) => {
                        if (onChange) {
                            onChange(value as string, c === true);
                        }
                    }}
                    data-slot="checkbox"
                    className={cn(
                        'peer checkbox-default-border size-4 shrink-0 rounded-sm dark:bg-input/30',
                        'border border-border-secondary',
                        'data-[state=checked]:border-primary data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
                        'data-[state=indeterminate]:border-primary data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
                        'dark:data-[state=checked]:bg-primary dark:data-[state=indeterminate]:bg-primary',
                        'transition-shadow outline-none',
                        'focus-visible:border-primary focus-visible:outline-none',
                        'aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40',
                        'disabled:cursor-not-allowed disabled:opacity-50',
                        className,
                    )}
                    {...(rest as React.ComponentPropsWithoutRef<typeof CheckboxPrimitive.Root>)}
                >
                    <CheckboxPrimitive.Indicator
                        data-slot="checkbox-indicator"
                        className="grid place-content-center text-current transition-none"
                    >
                        {indeterminate ? <MinusIcon className="size-3.5" /> : <CheckIcon className="size-3.5" />}
                    </CheckboxPrimitive.Indicator>
                </CheckboxPrimitive.Root>
                {label && (
                    <Label
                        htmlFor={id}
                        className={cn(
                            'cursor-pointer text-sm font-normal peer-disabled:cursor-not-allowed peer-disabled:opacity-70',
                            labelClassName,
                        )}
                    >
                        {label}
                    </Label>
                )}
            </div>
        );
    },
);

Checkbox.displayName = 'Checkbox';

export { CheckboxShadcn, Checkbox };
