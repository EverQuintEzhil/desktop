import { cn } from '@/lib/utils';

import type { FindMatchTick } from './use-find-in-conversation';

interface FindMatchTicksProps {
    ticks: FindMatchTick[];
    activeKey: number | null;
}

/**
 * Hit positions down the length of the thread, mirroring the browser's own find
 * ticks. Its own rail rather than the scrollbar because the viewport uses the
 * custom scrollbar utilities, which cannot carry markers. Presentational only —
 * stepping is the bar's job, so the rail stays out of the a11y tree.
 */
const FindMatchTicks = ({ ticks, activeKey }: FindMatchTicksProps) => {
    if (ticks.length === 0) return null;

    return (
        <div
            aria-hidden="true"
            data-find-skip=""
            className="find-match-ticks pointer-events-none absolute inset-y-0 right-1 z-20 w-3 max-lg:hidden"
        >
            {ticks.map((tick) => (
                <span
                    key={tick.key}
                    style={{ top: `${tick.ratio * 100}%` }}
                    className={cn(
                        'find-match-tick absolute right-0 h-0.5 w-full rounded-full',
                        tick.key === activeKey ? 'bg-find-highlight-current' : 'bg-find-highlight',
                    )}
                />
            ))}
        </div>
    );
};

export default FindMatchTicks;
