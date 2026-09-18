import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';
import { formatDateTime, formatRelativeTime } from '@/utils/date';

interface Props {
    label: string;
    date: string | null | undefined;
    emptyText?: string;
    /** Drop the visible label where space is tight; the hover and screen-reader text keep it. */
    showLabel?: boolean;
    className?: string;
}

const TEXT_CLASS = 'text-xs font-medium text-text-secondary';

/** Relative text answers "which one is latest" at a glance; the exact stamp rides along for hover and screen readers. */
const RelativeTimestamp = ({ label, date, emptyText, showLabel = true, className }: Props) => {
    const renderEmpty = () => {
        if (!emptyText) return null;

        return <span className={cn(TEXT_CLASS, className)}>{emptyText}</span>;
    };

    if (!date) return renderEmpty();

    const relative = formatRelativeTime(date);

    if (relative === date) return null;

    const exact = `${label} at: ${formatDateTime(date)}`;

    return (
        <SimpleTooltip content={exact}>
            <span className={cn(TEXT_CLASS, className)}>
                <span aria-hidden="true">{showLabel ? `${label} ${relative}` : relative}</span>
                <span className="sr-only">{exact}</span>
            </span>
        </SimpleTooltip>
    );
};

export default RelativeTimestamp;
