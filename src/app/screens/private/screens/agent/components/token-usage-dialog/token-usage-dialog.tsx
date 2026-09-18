import { ActivityIcon, BarChart3Icon, CircleDollarSignIcon, LeafIcon, XIcon, type LucideIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { cn } from '@/lib/utils';

export interface TokenUsage {
    input_tokens: number;
    output_tokens: number;
    reasoning_tokens?: number;
    total_tokens: number;
    cached_input_tokens?: number | null;
    cache_write_input_tokens?: number | null;
    input_tokens_co2?: number | null;
    cached_input_tokens_co2?: number | null;
    cache_write_input_tokens_co2?: number | null;
    output_tokens_co2?: number | null;
    reasoning_tokens_co2?: number | null;
    total_tokens_co2?: number | null;
    co2_multiplier_per_token?: number | null;
    input_tokens_cost?: number | null;
    cached_input_tokens_cost?: number | null;
    cache_write_input_tokens_cost?: number | null;
    output_tokens_cost?: number | null;
    reasoning_tokens_cost?: number | null;
    total_tokens_cost?: number | null;
    input_cost_per_million_tokens?: number | null;
    cached_input_cost_per_million_tokens?: number | null;
    cache_write_input_cost_per_million_tokens?: number | null;
    output_cost_per_million_tokens?: number | null;
    reasoning_cost_per_million_tokens?: number | null;
}

interface TokenUsageDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    usage: TokenUsage;
    model?: string;
    /** Extra scope shown after the model in the header, e.g. "this conversation". */
    subtitle?: string;
}

type RowType = 'input' | 'cached' | 'cacheWrite' | 'output' | 'reasoning';

const ROW_ORDER: RowType[] = ['input', 'cached', 'cacheWrite', 'output', 'reasoning'];

const ROW_DOT_BY_TYPE: Record<RowType, string> = {
    input: 'bg-blue-400/70',
    cached: 'bg-sky-400/70',
    cacheWrite: 'bg-violet-400/70',
    reasoning: 'bg-amber-400/80',
    output: 'bg-primary',
};

interface BreakdownRow {
    type: RowType;
    label: string;
    dotClassName: string;
    tokens: number | null;
    co2: number | null;
    cost: number | null;
}

const Co2TokenUnit = () => (
    <span className="ml-0.5 text-[0.7em] font-semibold text-current">
        kgCO
        <sub>2</sub>e
    </span>
);

const getUsageValue = (value: number | null | undefined) => {
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;

    return value;
};

const formatCost = (value: number) =>
    `$${value.toLocaleString(undefined, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
    })}`;

const formatCo2 = (value: number) =>
    value.toLocaleString(undefined, {
        minimumFractionDigits: 3,
        maximumFractionDigits: 3,
    });

// Per-token multiplier is ~1e-7; three fraction digits would flatten it to "0.000".
const formatCo2Multiplier = (value: number) =>
    value.toLocaleString(undefined, {
        maximumFractionDigits: 15,
        minimumFractionDigits: 3,
    });

const excludeSubsets = (value: number | null, ...subsets: Array<number | null>) => {
    if (value === null) return null;
    const subtracted = subsets.reduce<number>((acc, subset) => acc + (subset ?? 0), 0);

    return subtracted > 0 ? Math.max(value - subtracted, 0) : value;
};

// Merge tokens / CO₂ / cost into one row per token type, keyed on RowType so a row's
// three metrics never diverge. The provider reports cached / cache-write as subsets of
// input_tokens and reasoning as a subset of output_tokens (ai repo, extract_ai_info.js),
// and the same holds for their CO₂ and cost figures. Each subset is therefore subtracted
// out of its parent row so the rows — and the distribution bar — sum to Total.
const buildBreakdownRows = (usage: TokenUsage): BreakdownRow[] => {
    const cachedInputTokens = getUsageValue(usage.cached_input_tokens);
    const cacheWriteInputTokens = getUsageValue(usage.cache_write_input_tokens);
    const hasCacheSplit = (cachedInputTokens ?? 0) > 0 || (cacheWriteInputTokens ?? 0) > 0;

    const reasoningTokens = getUsageValue(usage.reasoning_tokens);
    const reasoningTokensCo2 = getUsageValue(usage.reasoning_tokens_co2);
    const reasoningTokensCost = getUsageValue(usage.reasoning_tokens_cost);
    const hasReasoningSplit = (reasoningTokens ?? 0) > 0;

    const cells: Record<RowType, { label: string; tokens: number | null; co2: number | null; cost: number | null }> = {
        input: {
            label: 'Input',
            tokens: hasCacheSplit
                ? (excludeSubsets(usage.input_tokens ?? null, cachedInputTokens, cacheWriteInputTokens) ??
                  usage.input_tokens)
                : usage.input_tokens,
            co2: hasCacheSplit
                ? excludeSubsets(
                      getUsageValue(usage.input_tokens_co2),
                      getUsageValue(usage.cached_input_tokens_co2),
                      getUsageValue(usage.cache_write_input_tokens_co2),
                  )
                : getUsageValue(usage.input_tokens_co2),
            cost: hasCacheSplit
                ? excludeSubsets(
                      getUsageValue(usage.input_tokens_cost),
                      getUsageValue(usage.cached_input_tokens_cost),
                      getUsageValue(usage.cache_write_input_tokens_cost),
                  )
                : getUsageValue(usage.input_tokens_cost),
        },
        cached: {
            label: 'Cached input',
            tokens: cachedInputTokens,
            co2: getUsageValue(usage.cached_input_tokens_co2),
            cost: getUsageValue(usage.cached_input_tokens_cost),
        },
        cacheWrite: {
            label: 'Cache write',
            tokens: cacheWriteInputTokens,
            co2: getUsageValue(usage.cache_write_input_tokens_co2),
            cost: getUsageValue(usage.cache_write_input_tokens_cost),
        },
        output: {
            label: 'Output',
            tokens: hasReasoningSplit
                ? excludeSubsets(getUsageValue(usage.output_tokens), reasoningTokens)
                : getUsageValue(usage.output_tokens),
            co2: hasReasoningSplit
                ? excludeSubsets(getUsageValue(usage.output_tokens_co2), reasoningTokensCo2)
                : getUsageValue(usage.output_tokens_co2),
            cost: hasReasoningSplit
                ? excludeSubsets(getUsageValue(usage.output_tokens_cost), reasoningTokensCost)
                : getUsageValue(usage.output_tokens_cost),
        },
        reasoning: {
            label: 'Reasoning',
            tokens: reasoningTokens,
            co2: reasoningTokensCo2,
            cost: reasoningTokensCost,
        },
    };

    return ROW_ORDER.map((type) => ({ type, dotClassName: ROW_DOT_BY_TYPE[type], ...cells[type] }));
};

interface HeaderStat {
    key: 'cost' | 'tokens' | 'co2e';
    label: string;
    icon: LucideIcon;
    value: React.ReactNode;
}

interface StatCardProps {
    stat: HeaderStat;
    /** CO₂e is the priority metric, so its label and value read in green. */
    accent?: boolean;
    className?: string;
}

const ACCENT_TEXT = 'text-emerald-600 dark:text-emerald-400';

// Font sizes stay fixed across breakpoints, so phones get at most two cards per
// row — three would clip the widest cost value instead of shrinking it.
const STAT_GRID = 'grid-cols-2 sm:grid-cols-3';

const StatCard = ({ stat, accent, className }: StatCardProps) => {
    const Icon = stat.icon;

    return (
        <div
            className={cn(
                'flex min-w-0 flex-col justify-between gap-2.5 rounded-2xl px-3 py-3 sm:px-3.5',
                accent ? 'bg-emerald-50 dark:bg-emerald-950/40' : 'bg-muted',
                className,
            )}
        >
            <div className="flex min-w-0 items-start gap-1.5">
                <Icon className={cn('mt-px size-3.5 shrink-0', accent ? ACCENT_TEXT : 'text-muted-foreground')} />
                <span
                    className={cn(
                        'min-w-0 text-[11px] leading-tight font-medium',
                        accent ? cn('font-semibold', ACCENT_TEXT) : 'text-muted-foreground',
                    )}
                >
                    {stat.label}
                </span>
            </div>
            <div
                className={cn(
                    'text-base leading-none whitespace-nowrap tabular-nums',
                    accent ? cn('font-bold', ACCENT_TEXT) : 'font-semibold text-foreground',
                )}
            >
                {stat.value}
            </div>
        </div>
    );
};

interface UsageDistributionBarProps {
    rows: BreakdownRow[];
    total: number;
}

const UsageDistributionBar = ({ rows, total }: UsageDistributionBarProps) => {
    // The empty track still renders when there is nothing to plot, so the row never
    // collapses; a zero total would make every width NaN.
    const segments = total > 0 ? rows.filter((row) => (row.tokens ?? 0) > 0) : [];

    return (
        <div className="flex h-2 w-full overflow-hidden rounded-full bg-muted">
            {segments.map((segment) => (
                <div
                    key={segment.type}
                    className={cn('h-full', segment.dotClassName)}
                    style={{ width: `${((segment.tokens ?? 0) / total) * 100}%` }}
                />
            ))}
        </div>
    );
};

export const TokenUsageDialog = ({ open, onOpenChange, usage, model, subtitle }: TokenUsageDialogProps) => {
    const rows = buildBreakdownRows(usage);
    // total_tokens is typed as required but arrives unvalidated from the provider, which
    // omits it for some models — and this body runs for every assistant message in the
    // thread, since the dialog is mounted closed rather than on demand.
    const totalTokens = getUsageValue(usage.total_tokens) ?? 0;
    const totalTokensCo2 = getUsageValue(usage.total_tokens_co2) ?? 0;
    const totalTokensCost = getUsageValue(usage.total_tokens_cost) ?? 0;
    const co2MultiplierPerToken = getUsageValue(usage.co2_multiplier_per_token) ?? 0;

    const stats: HeaderStat[] = [
        {
            key: 'tokens',
            label: 'Total tokens',
            icon: BarChart3Icon,
            value: totalTokens.toLocaleString(),
        },
        {
            key: 'cost',
            label: 'Total cost',
            icon: CircleDollarSignIcon,
            value: formatCost(totalTokensCost),
        },
        {
            key: 'co2e',
            label: 'Total kgCO₂e',
            icon: LeafIcon,
            value: (
                <>
                    {formatCo2(totalTokensCo2)}
                    <Co2TokenUnit />
                </>
            ),
        },
    ];

    const valueColumns: Array<{ key: 'tokens' | 'co2' | 'cost'; heading: React.ReactNode }> = [
        { key: 'tokens', heading: 'Tokens' },
        { key: 'co2', heading: 'kgCO₂e' },
        { key: 'cost', heading: 'Cost' },
    ];

    const gridTemplateColumns = `minmax(0,0.9fr) ${valueColumns.map(() => 'minmax(0,1fr)').join(' ')}`;

    // Numbers must never wrap (a broken "$0.024862" reads as two rows on narrow screens);
    // shrink the type on mobile so the widest cost cell still fits instead.
    const numericCellClass = 'whitespace-nowrap text-right text-[11.5px] tabular-nums sm:text-[13.5px]';

    const formatCell = (key: 'tokens' | 'co2' | 'cost', value: number | null) => {
        if (key === 'cost') return formatCost(value ?? 0);
        if (key === 'co2') return formatCo2(value ?? 0);

        return (value ?? 0).toLocaleString();
    };

    const totalByKey: Record<'tokens' | 'co2' | 'cost', number> = {
        tokens: totalTokens,
        co2: totalTokensCo2,
        cost: totalTokensCost,
    };

    // const renderPricing = () => {
    //     const rateRows: Array<{ label: string; rate: number }> = [
    //         { label: 'Input', rate: getUsageValue(usage.input_cost_per_million_tokens) ?? NaN },
    //         { label: 'Cached input', rate: getUsageValue(usage.cached_input_cost_per_million_tokens) ?? NaN },
    //         { label: 'Cache write', rate: getUsageValue(usage.cache_write_input_cost_per_million_tokens) ?? NaN },
    //         { label: 'Output', rate: getUsageValue(usage.output_cost_per_million_tokens) ?? NaN },
    //         { label: 'Reasoning', rate: getUsageValue(usage.reasoning_cost_per_million_tokens) ?? NaN },
    //     ].filter((rateRow) => Number.isFinite(rateRow.rate));

    //     if (rateRows.length === 0) return null;

    //     return (
    //         <div className="flex flex-col gap-1">
    //             <div className="mb-1 text-[11.5px] font-semibold uppercase tracking-wide text-muted-foreground">
    //                 Pricing · per 1M tokens
    //             </div>
    //             <div className="rounded-2xl border border-border px-4">
    //                 {rateRows.map((rateRow, index) => (
    //                     <div
    //                         key={rateRow.label}
    //                         className={cn(
    //                             'flex items-center justify-between py-2.5',
    //                             index < rateRows.length - 1 && 'border-b border-border/60',
    //                         )}
    //                     >
    //                         <span className="text-[13px] font-medium text-muted-foreground">{rateRow.label}</span>
    //                         <span className="text-[13px] font-semibold tabular-nums text-foreground">
    //                             {`${formatCost(rateRow.rate)} / 1M`}
    //                         </span>
    //                     </div>
    //                 ))}
    //             </div>
    //         </div>
    //     );
    // };

    const headerSubtitle = [model, subtitle].filter(Boolean).join(' · ');

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="w-[calc(100%-2rem)] max-w-xl">
                <DialogHeader className="flex-row items-center gap-3.5 border-b-0 pb-2">
                    <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <ActivityIcon className="size-5" />
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                        <DialogTitle className="text-h3 font-semibold">AI Usage Estimate</DialogTitle>
                        {headerSubtitle && (
                            <span className="truncate text-xs font-medium text-muted-foreground">{headerSubtitle}</span>
                        )}
                    </div>
                    <DialogClose asChild>
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-sm"
                            className="shrink-0 rounded-full"
                            aria-label="Close"
                        >
                            <XIcon />
                        </Button>
                    </DialogClose>
                </DialogHeader>

                <DialogBody className="flex flex-col gap-5 py-4">
                    <div className={cn('grid gap-2 sm:gap-3', STAT_GRID)}>
                        {stats.map((stat) => (
                            <StatCard
                                key={stat.key}
                                stat={stat}
                                accent={stat.key === 'co2e'}
                                className={stat.key === 'co2e' ? 'col-span-2 sm:col-span-1' : undefined}
                            />
                        ))}
                    </div>

                    <div className="flex flex-col gap-3">
                        <div className="text-[11.5px] font-semibold tracking-wide text-muted-foreground uppercase">
                            Breakdown
                        </div>
                        <UsageDistributionBar rows={rows} total={totalTokens} />

                        <div className="flex flex-col gap-2.5">
                            <div className="grid items-baseline gap-x-2 sm:gap-x-3" style={{ gridTemplateColumns }}>
                                <div />
                                {valueColumns.map((column) => (
                                    <div
                                        key={column.key}
                                        className="text-right text-[11px] font-medium whitespace-nowrap text-muted-foreground"
                                    >
                                        {column.heading}
                                    </div>
                                ))}
                            </div>

                            {rows.map((row) => (
                                <div
                                    key={row.type}
                                    className="grid items-center gap-x-2 sm:gap-x-3"
                                    style={{ gridTemplateColumns }}
                                >
                                    <div className="flex min-w-0 items-center gap-2">
                                        <span className={cn('size-2 shrink-0 rounded-full', row.dotClassName)} />
                                        <span className="truncate text-[13px] font-medium text-foreground sm:text-[13.5px]">
                                            {row.label}
                                        </span>
                                    </div>
                                    {valueColumns.map((column) => (
                                        <div
                                            key={column.key}
                                            className={cn(numericCellClass, 'font-medium text-foreground')}
                                        >
                                            {formatCell(column.key, row[column.key])}
                                        </div>
                                    ))}
                                </div>
                            ))}

                            <div
                                className="grid items-baseline gap-x-2 border-t border-border pt-3 sm:gap-x-3"
                                style={{ gridTemplateColumns }}
                            >
                                <div className="text-[13px] font-semibold text-foreground sm:text-[13.5px]">Total</div>
                                {valueColumns.map((column) => (
                                    <div
                                        key={column.key}
                                        className={cn(numericCellClass, 'font-semibold text-foreground')}
                                    >
                                        {formatCell(column.key, totalByKey[column.key])}
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="flex items-center gap-2 rounded-xl bg-muted px-3 py-2.5">
                            <LeafIcon className="size-3.5 shrink-0 text-emerald-600" />
                            <span className="flex-1 text-xs font-medium text-muted-foreground">
                                kgCO₂e multiplier per token
                            </span>
                            <span className="text-xs font-semibold text-foreground tabular-nums">
                                {formatCo2Multiplier(co2MultiplierPerToken)}
                            </span>
                        </div>
                    </div>

                    {/* {renderPricing()} */}
                </DialogBody>
            </DialogContent>
        </Dialog>
    );
};

export default TokenUsageDialog;
