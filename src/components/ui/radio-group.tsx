import { CircleIcon } from 'lucide-react';
import { RadioGroup as RadioGroupPrimitive } from 'radix-ui';
import * as React from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface RadioButtonProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    onChange?: (value: string | number | readonly string[] | undefined, checked: boolean) => void;
    styles?: string;
    preventDefault?: boolean;
    label?: string;
    isErrored?: boolean;
}

interface RadioOption {
    name: string;
    value: string;
    label: string;
}

export interface RadioGroupProps {
    options: RadioOption[];
    checked: string;
    onChange: (value: string) => void;
    gap?: string;
    header?: string;
    direction?: 'horizontal' | 'vertical';
    styles?: string;
    className?: string;
}

const RadioButton = React.forwardRef<
    React.ElementRef<typeof RadioGroupPrimitive.Item>,
    React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Item> & RadioButtonProps
>(
    (
        { id = 'radioId', value, disabled, preventDefault = true, className = '', label, styles, isErrored, ...rest },
        ref,
    ) => {
        return (
            <div
                className={`radio flex items-center space-x-2 ${isErrored ? 'has-error' : ''}`}
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
                <RadioGroupItemShadcn
                    ref={ref}
                    id={id}
                    value={value as string}
                    disabled={disabled}
                    className={className}
                    onClick={(e) => {
                        if (preventDefault) e.stopPropagation();
                    }}
                    {...rest}
                />
                {label && (
                    <Label
                        htmlFor={id}
                        className="cursor-pointer text-sm peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                    >
                        {label}
                    </Label>
                )}
            </div>
        );
    },
);

RadioButton.displayName = 'RadioButton';

const GAP_CLASS_MAP: Record<string, string> = {
    '8px': 'gap-2',
    '0.5rem': 'gap-2',
    '12px': 'gap-3',
    '0.75rem': 'gap-3',
    '16px': 'gap-4',
    '1rem': 'gap-4',
};

const RadioGroup = React.forwardRef<
    React.ElementRef<typeof RadioGroupPrimitive.Root>,
    Omit<React.ComponentPropsWithoutRef<typeof RadioGroupPrimitive.Root>, 'onChange'> & RadioGroupProps
>(
    (
        {
            options,
            checked,
            onChange,
            gap = '1rem',
            header = '',
            direction = 'horizontal',
            styles,
            className,
            ...props
        },
        ref,
    ) => {
        const gapClass = GAP_CLASS_MAP[gap] ?? 'gap-4';

        return (
            <div
                className={cn('flex flex-col gap-2', className)}
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
            >
                {header && <h4 className="text-sm font-semibold">{header}</h4>}
                <RadioGroupPrimitive.Root
                    ref={ref}
                    className={cn('flex flex-wrap', direction === 'horizontal' ? 'flex-row' : 'flex-col', gapClass)}
                    value={checked}
                    onValueChange={(val) => {
                        onChange(val === checked ? '' : val); // toggle behavior
                    }}
                    {...props}
                >
                    {options.map((option) => (
                        <RadioButton
                            key={option.value}
                            id={`radio-${option.value}`}
                            name={option.name}
                            label={option.label}
                            value={option.value}
                        />
                    ))}
                </RadioGroupPrimitive.Root>
            </div>
        );
    },
);

RadioGroup.displayName = 'RadioGroup';

function RadioGroupShadcn({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Root>) {
    return <RadioGroupPrimitive.Root data-slot="radio-group" className={cn('grid gap-3', className)} {...props} />;
}

function RadioGroupItemShadcn({ className, ...props }: React.ComponentProps<typeof RadioGroupPrimitive.Item>) {
    return (
        <RadioGroupPrimitive.Item
            data-slot="radio-group-item"
            className={cn(
                [
                    'border-border-secondary',
                    'text-primary',
                    'focus-visible:outline-none focus-visible:border-primary',
                    'data-[state=checked]:border-primary',
                    'aria-invalid:border-destructive',
                    'aspect-square',
                    'size-4',
                    'shrink-0',
                    'rounded-full',
                    'border',
                    'shadow-xs',
                    'transition-[color,box-shadow]',
                    'outline-none',
                    'disabled:cursor-not-allowed',
                    'disabled:opacity-50',
                ].join(' '),
                className,
            )}
            {...props}
        >
            <RadioGroupPrimitive.Indicator
                data-slot="radio-group-indicator"
                className="relative flex items-center justify-center"
            >
                <CircleIcon className="absolute top-1/2 left-1/2 size-2 -translate-x-1/2 -translate-y-1/2 fill-primary" />
            </RadioGroupPrimitive.Indicator>
        </RadioGroupPrimitive.Item>
    );
}

export { RadioGroupShadcn, RadioGroupItemShadcn, RadioButton, RadioGroup };
