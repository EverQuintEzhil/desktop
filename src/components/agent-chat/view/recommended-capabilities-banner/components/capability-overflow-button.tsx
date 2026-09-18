import { cn } from '@/lib/utils';

import { FOCUS_RING_CLASSES } from '../constants';

interface Props {
    hiddenCount: number;
    /** The row's accessible name, so the count reads as "Show 3 more <row>". */
    rowAccessibleName: string;
    onClick: () => void;
}

const CapabilityOverflowButton = ({ hiddenCount, rowAccessibleName, onClick }: Props) => (
    <button
        type="button"
        aria-label={`Show ${hiddenCount} more ${rowAccessibleName.toLowerCase()}`}
        onClick={onClick}
        className={cn(
            'flex h-7 shrink-0 items-center justify-center rounded-full px-2.5 text-xs font-medium',
            'border border-border text-muted-foreground hover:text-foreground',
            'bg-transparent transition-colors hover:bg-[var(--surface-hover)]',
            'cursor-pointer whitespace-nowrap',
            FOCUS_RING_CLASSES,
        )}
    >
        +{hiddenCount}
    </button>
);

export default CapabilityOverflowButton;
