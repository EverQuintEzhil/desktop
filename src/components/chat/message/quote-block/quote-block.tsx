import { CornerDownRight } from 'lucide-react';

import { cn } from '@/lib/utils';

import './quote-block.scss';

interface QuoteBlockProps {
    text: string;
    onClick?: () => void;
}

const baseClassName = 'flex w-fit items-start gap-2 max-w-full rounded-lg bg-muted px-3 py-2 mb-2';

export const QuoteBlock = ({ text, onClick }: QuoteBlockProps) => {
    const content = (
        <>
            <CornerDownRight
                className="mt-0.5 size-4 shrink-0 text-muted-foreground group-hover:text-foreground"
                aria-hidden="true"
            />
            <span className="line-clamp-3 min-w-0 text-sm wrap-break-word text-muted-foreground group-hover:text-foreground">
                {`“${text}”`}
            </span>
        </>
    );

    if (onClick) {
        return (
            <button
                type="button"
                onClick={onClick}
                title="Go to referenced message"
                aria-label="Go to referenced message"
                className={cn(
                    baseClassName,
                    'group mb-0 cursor-pointer bg-transparent p-0 text-left transition-colors',
                )}
            >
                {content}
            </button>
        );
    }

    return <div className={baseClassName}>{content}</div>;
};
