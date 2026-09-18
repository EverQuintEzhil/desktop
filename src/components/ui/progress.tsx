import { Progress as ProgressPrimitive } from 'radix-ui';
import * as React from 'react';

import { cn } from '@/lib/utils';

/**
 * Shadcn Progress primitive — thin Radix UI wrapper.
 * `value` is a number from 0–100.
 */
function Progress({ className, value, ...props }: React.ComponentProps<typeof ProgressPrimitive.Root>) {
    return (
        <ProgressPrimitive.Root
            data-slot="progress"
            className={cn('relative h-2 w-full overflow-hidden rounded-full bg-primary/20', className)}
            {...props}
        >
            <ProgressPrimitive.Indicator
                data-slot="progress-indicator"
                className="h-full w-full flex-1 bg-primary transition-all"
                style={{ transform: `translateX(-${100 - (value || 0)}%)` }}
            />
        </ProgressPrimitive.Root>
    );
}

export interface ProgressBarProps extends React.HTMLAttributes<HTMLDivElement> {
    /** Progress value as a percent string, e.g. `"75%"` */
    value?: string;
    /** Max-width of the bar track, e.g. `"300px"` or `300` */
    width?: string | number;
    /** Threshold position for the limit marker line (numeric percent, e.g. `80`) */
    limit?: string;
    /** Colour of the limit marker line and hint accent */
    limitColor?: string;
    /** Show the hint section below the bar */
    hint?: boolean;
    /** Bold coloured key text shown in the hint */
    hintTextKey?: string;
    /** Regular text shown alongside the hint key */
    hintTextValue?: string;
    /** Legacy inline-CSS string forwarded to the wrapper */
    styles?: string;
}

function parsePercent(val?: string): number {
    if (!val) return 0;
    const n = parseFloat(val);

    return Number.isNaN(n) ? 0 : Math.min(100, Math.max(0, n));
}

/**
 * Shadcn-based drop-in replacement for the custom `ProgressBar` component.
 *
 * Features:
 * - Progress bar filled to `value` (percent string like `"75%"`)
 * - Optional `width` cap on the bar track
 * - Optional `limit` marker line at a given % position, coloured with `limitColor`
 * - Optional `hint` section below with a coloured left-border legend
 * - `styles` legacy inline-CSS forwarded to the wrapper
 */
const ProgressBar = (props: ProgressBarProps) => {
    const {
        hint = false,
        hintTextKey,
        hintTextValue,
        limit,
        limitColor = '#E6492C',
        styles,
        value,
        width,
        className,
        ...rest
    } = props;

    const numericValue = parsePercent(value);
    const isComplete = value === '100%';

    return (
        <div
            className={cn('progress-bar relative', isComplete && 'right-corner', className)}
            style={styles ? ({ cssText: styles } as React.CSSProperties) : undefined}
            {...rest}
        >
            {/* ── Controller row: value label + bar track ── */}
            <div className="controller flex items-center gap-2">
                <span className="shrink-0 text-sm">{value}</span>

                {/* Bar track */}
                <div className="relative h-2 w-full rounded-full bg-[#EAEAEA]" style={{ maxWidth: width }}>
                    {/* Fill */}
                    <div
                        className="absolute top-0 left-0 h-full rounded-full bg-[#1C9B49] transition-all"
                        style={{ width: `${numericValue}%` }}
                    />

                    {/* Limit marker — vertical line at `limit`% */}
                    {limit && (
                        <div
                            className="absolute -top-1 -bottom-1 w-0.5"
                            style={{
                                left: `calc(${limit}% - 1px)`,
                                backgroundColor: limitColor,
                            }}
                        />
                    )}
                </div>
            </div>

            {/* ── Hint section ── */}
            {hint && (hintTextKey || hintTextValue) && (
                <div
                    className="hint relative mt-2.5 py-1 pl-3 text-sm text-[#2D2D2D]"
                    style={{
                        // Left-border accent coloured with limitColor
                        borderLeft: `3px solid ${limitColor}`,
                    }}
                >
                    <span className="font-medium" style={{ color: limitColor }}>
                        {hintTextKey}
                        {' - '}
                    </span>
                    <span className="text-sm">{hintTextValue}</span>
                </div>
            )}
        </div>
    );
};

export { Progress, ProgressBar };
export default ProgressBar;
