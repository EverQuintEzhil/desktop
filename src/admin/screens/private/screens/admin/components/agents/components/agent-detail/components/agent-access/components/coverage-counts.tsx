import { Fragment } from 'react';

import { cn } from '@/lib/utils';

import type { KindCoverage } from '../access-coverage';
import { coverageParts } from '../access-coverage';

interface CoverageCountsProps {
    coverage: KindCoverage;
    /** A section row reads across; a tooltip has the height to spare and reads down. */
    layout: 'row' | 'column';
    className?: string;
}

/**
 * The four numbers behind a section's ratio. One source for the row and the tooltip, so the same
 * figures cannot be read two ways; the label tone is an opacity rather than a token because it also
 * has to sit on the tooltip's own background.
 */
const CoverageCounts = ({ coverage, layout, className }: CoverageCountsProps) => {
    const parts = coverageParts(coverage);

    // Numbers get a column of their own in both layouts, so they stay in line whether the count is
    // 1 or 15.
    if (layout === 'column') {
        return (
            <span className={cn('grid grid-cols-[1.75rem_auto] gap-x-2 gap-y-1 text-xs', className)}>
                {parts.map((part) => (
                    <Fragment key={part.label}>
                        <span className={cn('text-right font-medium tabular-nums', part.value === 0 && 'opacity-45')}>
                            {part.value}
                        </span>
                        <span className={cn('opacity-70', part.value === 0 && 'opacity-45')}>{part.label}</span>
                    </Fragment>
                ))}
            </span>
        );
    }

    return (
        <span className={cn('grid grid-cols-4 gap-x-5 text-xs', className)}>
            {parts.map((part) => (
                <span
                    key={part.label}
                    className={cn(
                        'grid grid-cols-[1.75rem_auto] gap-1.5 whitespace-nowrap',
                        part.value === 0 && 'opacity-45',
                    )}
                >
                    <span className="text-right font-medium tabular-nums">{part.value}</span>
                    <span className="opacity-70">{part.label}</span>
                </span>
            ))}
        </span>
    );
};

export default CoverageCounts;
