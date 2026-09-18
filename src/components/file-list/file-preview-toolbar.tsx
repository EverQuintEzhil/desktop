import { ExternalLinkIcon, TrashIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';

interface FilePreviewDetailsProps {
    chips: string[];
    children?: ReactNode;
    attribution?: ReactNode;
}

export const FilePreviewDetails = ({ chips, children, attribution }: FilePreviewDetailsProps) => {
    return (
        <div className="file-preview-details scrollbar-controller scrollbar-horizontal flex min-w-0 items-center gap-2 text-xs whitespace-nowrap text-white/60">
            {attribution}
            {chips.map((chip, index) => (
                <span key={index} className="flex shrink-0 items-center gap-2">
                    {index > 0 || attribution ? (
                        <span aria-hidden className="opacity-50">
                            ·
                        </span>
                    ) : null}
                    {chip}
                </span>
            ))}
            {children}
        </div>
    );
};

interface FilePreviewActionsProps {
    onOpenInNewTab?: () => void;
    onDelete?: () => void;
    canDelete?: boolean;
    children?: React.ReactNode;
}

export const FilePreviewActions = ({
    onOpenInNewTab,
    onDelete,
    canDelete = false,
    children,
}: FilePreviewActionsProps) => (
    <>
        {children}
        {onOpenInNewTab ? (
            <SimpleTooltip content="Open in new tab" side="bottom" className="z-61">
                <Button
                    variant="black"
                    size="icon-sm"
                    className="rounded-full"
                    aria-label="Open in new tab"
                    onClick={onOpenInNewTab}
                >
                    <ExternalLinkIcon />
                </Button>
            </SimpleTooltip>
        ) : null}
        {canDelete && onDelete ? (
            <SimpleTooltip content="Delete" side="bottom" className="z-61">
                <Button variant="black" size="icon-sm" className="rounded-full" aria-label="Delete" onClick={onDelete}>
                    <TrashIcon />
                </Button>
            </SimpleTooltip>
        ) : null}
    </>
);
