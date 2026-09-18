import { InfoIcon } from 'lucide-react';
import { type ReactNode } from 'react';

import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

interface Props {
    id: string;
    title: string;
    icon?: ReactNode;
    required?: boolean;
    description?: string;
    filledCount?: number;
    totalCount?: number;
    statusText?: string;
    statusTone?: 'neutral' | 'success' | 'warning' | 'danger' | 'primary';
    errorCount?: number;
    defaultOpen?: boolean;
    alwaysOpen?: boolean;
    children: ReactNode;
}

const AccordionSection = ({
    id,
    title,
    icon,
    required,
    description,
    filledCount,
    totalCount,
    statusText,
    statusTone = 'neutral',
    errorCount,
    defaultOpen = false,
    alwaysOpen = false,
    children,
}: Props) => {
    const renderStatusBadge = (text: string, tone: NonNullable<Props['statusTone']> = statusTone, solid = false) => (
        <span
            className={cn(
                'ml-2 rounded-full border px-2 py-0.5 text-xs font-medium',
                !solid && tone === 'neutral' && 'border-border bg-muted/40 text-text-secondary',
                !solid && tone === 'success' && 'border-success/30 bg-success/10 text-success',
                !solid && tone === 'warning' && 'border-(--warning) bg-(--warning-bg) text-(--warning)',
                !solid && tone === 'danger' && 'border-(--danger) bg-(--danger-bg) text-(--danger)',
                !solid && tone === 'primary' && 'border-primary/20 bg-primary/10 text-primary',
                solid && tone === 'primary' && 'border-primary/20 bg-primary/10 text-primary',
                solid && tone === 'neutral' && 'border-border bg-muted text-text-secondary',
            )}
        >
            {text}
        </span>
    );

    const renderRequiredBadge = () => {
        if (required === undefined) return null;

        return required ? (
            <span className="ml-2 rounded-full border border-(--danger)/40 bg-(--danger-bg) px-2 py-0.5 text-xs font-semibold text-(--danger)">
                Required
            </span>
        ) : null;
    };

    const renderCounter = () => {
        if (errorCount && errorCount > 0) {
            return renderStatusBadge(`${errorCount} ${errorCount === 1 ? 'error' : 'errors'}`, 'danger', true);
        }
        if (statusText) return renderStatusBadge(statusText, statusTone, true);
        if (totalCount === undefined) return null;

        return renderStatusBadge(`${filledCount ?? 0} / ${totalCount}`, statusTone, true);
    };

    const renderDescription = () => {
        if (!description) return null;

        return (
            <SimpleTooltip content={description} side="bottom">
                <span className="ml-2 rounded-full text-primary">
                    <InfoIcon className="size-4" />
                </span>
            </SimpleTooltip>
        );
    };

    const renderHeaderContent = () => {
        return (
            <div className="flex flex-1 items-center justify-between gap-2">
                <div className="flex min-w-0 items-center gap-1">
                    {icon ? (
                        <span className="mr-2 flex size-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
                            {icon}
                        </span>
                    ) : null}
                    <span className="truncate text-sm font-medium">{title}</span>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {renderRequiredBadge()}
                    {renderCounter()}
                    {renderDescription()}
                </div>
            </div>
        );
    };

    if (alwaysOpen) {
        return (
            <div className="border-b border-border last:border-b-0">
                <div className="px-3 py-2.5">{renderHeaderContent()}</div>
                <div className="text-sm">
                    <div className="px-3 pt-1 pb-4">
                        <div className="flex flex-col gap-3">{children}</div>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <Accordion
            type="single"
            collapsible
            defaultValue={defaultOpen ? id : undefined}
            className="border-b border-border last:border-b-0"
        >
            <AccordionItem value={id} className="border-b-0">
                <AccordionTrigger
                    className={cn(
                        'rounded-none px-3 py-2 transition-colors hover:bg-muted/40 hover:text-primary hover:no-underline',
                        'data-[state=open]:bg-primary/5 data-[state=open]:text-primary',
                    )}
                >
                    {renderHeaderContent()}
                </AccordionTrigger>
                <AccordionContent>
                    <div className="flex flex-col gap-3 px-3 pb-4">{children}</div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

export default AccordionSection;
