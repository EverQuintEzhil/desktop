import { cn } from '@/lib/utils';

interface AppLoadingSkeletonProps {
    /** data-slot marker so existing per-surface hooks keep working */
    slot?: string;
    className?: string;
}

/**
 * Generic loading placeholder shown while a GenUI / MCP-UI app boots.
 *
 * The backing app renders arbitrary content, so the skeleton stays deliberately
 * generic: a bordered card with a title bar and a few content lines. It keeps the
 * same outer footprint (max-w-[480px], ~h-24) as the real app so there is no layout
 * jump when the app swaps in.
 */
const AppLoadingSkeleton = ({ slot = 'app-loading-skeleton', className }: AppLoadingSkeletonProps) => (
    <div
        data-slot={slot}
        className={cn(
            'shimmer-container my-2 flex w-full max-w-[480px] flex-col gap-2.5 rounded-lg border border-border bg-card p-4',
            className,
        )}
        aria-busy="true"
        aria-label="Loading app"
    >
        <div className="h-3 w-2/5 rounded bg-foreground/15 shimmer-bg motion-reduce:animate-none" />
        <div className="h-2.5 w-full rounded bg-foreground/10 shimmer-bg motion-reduce:animate-none" />
        <div className="h-2.5 w-4/5 rounded bg-foreground/10 shimmer-bg motion-reduce:animate-none" />
        <div className="h-2.5 w-3/5 rounded bg-foreground/10 shimmer-bg motion-reduce:animate-none" />
    </div>
);

export { AppLoadingSkeleton };
