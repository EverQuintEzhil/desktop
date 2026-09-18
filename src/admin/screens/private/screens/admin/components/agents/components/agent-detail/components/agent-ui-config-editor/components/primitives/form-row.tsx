import { type ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface Props {
    label?: string;
    sub?: string;
    wide?: boolean;
    children: ReactNode;
    className?: string;
}

const FormRow = ({ label, sub, wide, children, className }: Props) => {
    const labelEl =
        label || sub ? (
            <div>
                {label ? <div className="text-sm font-medium">{label}</div> : null}
                {sub ? <div className="mt-0.5 text-xs leading-snug text-text-secondary">{sub}</div> : null}
            </div>
        ) : null;

    if (wide) {
        return (
            <div className={cn('flex flex-col gap-2 border-b border-border px-4 py-3 last:border-b-0', className)}>
                {labelEl}
                {children}
            </div>
        );
    }

    return (
        <div className={cn('@container border-b border-border px-4 py-3 last:border-b-0', className)}>
            <div className="row-form flex flex-col gap-2 @[480px]:grid @[480px]:grid-cols-[160px_1fr] @[480px]:items-start @[480px]:gap-4">
                <div className="row-form-label">{labelEl}</div>
                <div className="row-form-content min-w-0">{children}</div>
            </div>
        </div>
    );
};

export default FormRow;
