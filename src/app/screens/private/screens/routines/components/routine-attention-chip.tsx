import { Link } from 'react-router-dom';

import type { RunReconnectTarget } from '@/app/components/routine-runs';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';
import { type RunAttentionCounts } from '@/types/routines';

import { RUN_ATTENTION_ICONS, runAttentionLabel, runAttentionTone, runAttentionTotal } from '../constants';

interface Props {
    /** Unseen runs needing their owner, counted from the same capped feed as the new-run chip. */
    counts: RunAttentionCounts;
    routineName: string;
    /** Absent where the routine cannot be opened from this list, which leaves the chip as plain text. */
    to: string | null;
    /**
     * The single connector every counted run is waiting on, where there is one. Given, the chip names
     * it — AMP-569 asks the owner to see WHICH connector from the notification, and a count cannot say
     * that. Only the wording: the destination stays the run list, which is the one surface carrying
     * the per-run reconnect link AND the mark-as-read affordance. Pointing the chip straight at the
     * connector would strand a run that is still unread after the reconnect, leaving the chip
     * asserting a fix that is already done with no way to dismiss it.
     */
    reconnect?: RunReconnectTarget | null;
}

const RoutineAttentionChip = ({ counts, routineName, to, reconnect }: Props) => {
    const total = runAttentionTotal(counts);

    if (total <= 0) return null;

    const label = reconnect ? `Reconnect ${reconnect.name}` : runAttentionLabel(total);
    const tone = runAttentionTone(counts);
    const Icon = RUN_ATTENTION_ICONS[tone];
    // A glyph, never the sentence inline: this sits beside a name column that is the first thing
    // the table takes width from, and a sentence-wide chip leaves the name nothing to truncate to.
    const className = cn(
        'routine-attention-chip flex size-6 shrink-0 items-center justify-center rounded-full',
        tone === 'destructive' ? 'bg-destructive/10' : 'bg-muted',
    );
    // `index.css` sets `a { color: var(--primary) }` unlayered, which outranks every Tailwind text
    // utility on the link itself, so the tone has to sit on a child of it.
    const glyph = (
        <span className={cn('flex', tone === 'destructive' ? 'text-destructive' : 'text-text-secondary')}>
            <Icon aria-hidden="true" className="size-3.5" />
        </span>
    );

    if (!to) {
        return (
            <SimpleTooltip content={label} side="bottom">
                {/* `role="img"` and a tab stop, matching `run-reconnect-indicator`: `aria-label` is
                    ignored on a bare span's generic role, and without a link here there is nothing
                    else carrying the count. */}
                <span data-tone={tone} role="img" aria-label={label} tabIndex={0} className={className}>
                    {glyph}
                </span>
            </SimpleTooltip>
        );
    }

    // A sibling of the row's open button, never a child: nested interactive elements are invalid.
    return (
        <SimpleTooltip content={label} side="bottom">
            <Link
                to={to}
                data-tone={tone}
                aria-label={`${label} for ${routineName}`}
                className={cn(
                    className,
                    tone === 'destructive' ? 'hover:bg-destructive/20' : 'hover:bg-accent',
                    'focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:outline-none',
                )}
                onClick={(event) => event.stopPropagation()}
            >
                {glyph}
            </Link>
        </SimpleTooltip>
    );
};

export default RoutineAttentionChip;
