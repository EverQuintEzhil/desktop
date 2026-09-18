import { format } from 'date-fns';
import type { ReactNode } from 'react';

import { cn } from '@/lib/utils';
import { formatRelativeTime } from '@/utils/date';

export interface BlogBylineProps {
    /** Shown in full — "July 28, 2026" — with the relative form on hover. */
    date?: string | null;
    meta?: ReactNode;
    /** `stacked` is the article header, `inline` the collection header. */
    layout?: 'stacked' | 'inline';
    className?: string;
}

const isValidDate = (value?: string | null): boolean => Boolean(value) && !isNaN(new Date(value as string).getTime());

/** `2026-01-01` with no zone is read as UTC midnight, which is the previous day west of Greenwich. */
const DATE_ONLY = /^\d{4}-\d{2}-\d{2}$/;

const toDisplayDate = (value: string): Date => {
    if (!DATE_ONLY.test(value)) {
        return new Date(value);
    }

    const [year, month, day] = value.split('-').map(Number);

    return new Date(year, month - 1, day);
};

const BlogByline = (props: BlogBylineProps) => {
    const { date, meta, layout = 'stacked', className } = props;

    const hasDate = isValidDate(date);

    if (!meta && !hasDate) {
        return null;
    }

    /** The full date reads at a glance; "how long ago" is the hover, which is the way round Intercom has it. */
    const renderDate = () => {
        if (!hasDate) return null;

        const raw = date as string;
        const at = toDisplayDate(raw);
        // a date-only value goes into the attribute as written, so it cannot disagree with the text
        const stamp = DATE_ONLY.test(raw) ? raw : at.toISOString();

        return (
            <time dateTime={stamp} title={`Updated ${formatRelativeTime(at)}`}>
                {format(at, 'MMMM d, yyyy')}
            </time>
        );
    };

    if (layout === 'inline') {
        return (
            <span className={cn('blog-byline-text text-sm text-text-secondary', className)}>
                {meta}
                {meta && hasDate ? ' · ' : null}
                {renderDate()}
            </span>
        );
    }

    return (
        <span
            className={cn('blog-byline-text flex min-w-0 flex-col text-sm leading-snug text-text-secondary', className)}
        >
            {renderDate()}
        </span>
    );
};

export default BlogByline;
