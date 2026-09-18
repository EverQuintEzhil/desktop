import type { AnyFieldApi } from '@tanstack/react-form';
import React from 'react';

import { Label } from '@/components/ui/label';
import { cn } from '@/lib/utils';

export interface FormFieldProps {
    label: string;
    className?: string;
    description?: string;
    children: (isErrored: boolean) => React.ReactNode;
    field: AnyFieldApi;
    required?: boolean;
}

const FormField = (props: FormFieldProps) => {
    const { label, children, field, className, required, description } = props;

    const errors = field.state.meta.errors;
    const isErrored = !!errors?.length;

    return (
        <div className={cn('relative flex flex-col gap-2', isErrored && 'pb-5', className)}>
            {label && (
                <Label>
                    <span>
                        {label}
                        {required && <span className="text-xs text-destructive">*</span>}
                    </span>
                </Label>
            )}

            {children(isErrored)}

            {description && !isErrored && <p className="text-[13px] text-muted-foreground">{description}</p>}

            {isErrored && (
                <p className="absolute bottom-0 left-0 animate-in text-[11px] leading-[0.8] font-medium text-destructive duration-200 fade-in">
                    {errors.join(', ')}
                </p>
            )}
        </div>
    );
};

export default FormField;
