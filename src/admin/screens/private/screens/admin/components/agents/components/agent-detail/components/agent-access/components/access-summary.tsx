import { cn } from '@/lib/utils';

import type { AccessSummary as AccessSummaryData } from '../access-coverage';

interface AccessSummaryProps {
    summary: AccessSummaryData;
}

const AccessSummary = ({ summary }: AccessSummaryProps) => {
    const stats: { value: number; label: string; tone?: string }[] = [
        { value: summary.total, label: 'users can reach this agent' },
        { value: summary.ready, label: 'have everything they need', tone: 'text-success' },
        { value: summary.withGaps, label: 'missing something', tone: 'text-destructive' },
        { value: summary.viaGroup, label: 'got access via a group' },
        { value: summary.viaAdmin, label: 'reach it as platform admins' },
    ];

    return (
        <div className="access-summary scrollbar-controller scrollbar-horizontal flex">
            {stats.map((stat) => (
                <div
                    key={stat.label}
                    className="access-summary-stat min-w-[130px] flex-1 px-4 not-first:border-l not-first:border-border"
                >
                    <b className={cn('block text-lg leading-tight tabular-nums', stat.tone)}>{stat.value}</b>
                    <span className="text-xs whitespace-nowrap text-text-secondary">{stat.label}</span>
                </div>
            ))}
        </div>
    );
};

export default AccessSummary;
