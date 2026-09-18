import { useInfiniteQuery } from '@tanstack/react-query';
import { capitalize } from 'lodash';
import { CalendarDays, History, Monitor, ShieldAlert, Smartphone } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo } from 'react';

import { InfiniteScrollTrigger } from '@/components';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteScroll } from '@/hooks';
import { accountApi, type LoginActivity, type LoginActivityGroup } from '@/lib/api';
import { cn } from '@/lib/utils';
import { formatDateTime, formatRelativeTime } from '@/utils/date';

type Outcome = 'success' | 'failed' | 'signed-out' | 'other';

interface ParsedUserAgent {
    browser: string;
    os: string;
    isMobile: boolean;
}

const PAGE_SIZE = 20;

const SKELETON_ROWS = 5;

const parseUserAgent = (ua: string): ParsedUserAgent => {
    const value = String(ua);

    const detectBrowser = (): string => {
        if (/Edg/i.test(value)) {
            return 'Edge';
        }
        if (/Chrome|CriOS/i.test(value)) {
            return 'Chrome';
        }
        if (/Firefox|FxiOS/i.test(value)) {
            return 'Firefox';
        }
        if (/Safari/i.test(value)) {
            return 'Safari';
        }

        return 'Unknown browser';
    };

    const detectOs = (): string => {
        if (/Windows/i.test(value)) {
            return 'Windows';
        }
        if (/Android/i.test(value)) {
            return 'Android';
        }
        if (/iPhone|iPad|iPod/i.test(value)) {
            return 'iOS';
        }
        if (/Macintosh|Mac OS X/i.test(value)) {
            return 'macOS';
        }
        if (/Linux/i.test(value)) {
            return 'Linux';
        }

        return 'Unknown OS';
    };

    return {
        browser: detectBrowser(),
        os: detectOs(),
        isMobile: /Mobi|Android|iPhone|iPad/i.test(value),
    };
};

const cleanIpAddress = (ip: string): string => String(ip).replace(/^::ffff:/i, '');

// The API returns an opaque IdP id for federated logins, so there is no name to show.
// Microsoft is the only federated provider configured today; ENG-61 tracks returning a real name.
const getMethodLabel = (provider: string): string | null => {
    const value = String(provider).toLowerCase();

    if (!value) {
        return null;
    }
    if (value.includes('google')) {
        return 'Google';
    }
    if (value.includes('local') || value.includes('password') || value.includes('email')) {
        return 'Email & password';
    }

    return 'Microsoft';
};

const getOutcome = (activity: LoginActivity): Outcome => {
    if (activity.status === 'failed') {
        return 'failed';
    }
    if (String(activity.type).toLowerCase().includes('logout')) {
        return 'signed-out';
    }
    if (activity.status === 'success') {
        return 'success';
    }

    return 'other';
};

const getOutcomeLabel = (activity: LoginActivity): string => {
    const outcome = getOutcome(activity);

    if (outcome === 'failed') {
        return 'Failed';
    }
    if (outcome === 'signed-out') {
        return 'Signed out';
    }
    if (outcome === 'success') {
        return 'Signed in';
    }

    return capitalize(activity.status);
};

const getOutcomeClassName = (activity: LoginActivity): string => {
    const outcome = getOutcome(activity);

    if (outcome === 'success') {
        return 'border-transparent bg-emerald-50 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-400';
    }
    if (outcome === 'failed') {
        return 'border-transparent bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-400';
    }

    return 'border-transparent bg-muted text-muted-foreground';
};

const getDeviceIconClassName = (isFailed: boolean, isCurrent: boolean): string => {
    if (isFailed) {
        return 'bg-red-50 text-red-600 ring-red-100 dark:bg-red-950/40 dark:text-red-400 dark:ring-red-900/60';
    }
    if (isCurrent) {
        return 'bg-primary/10 text-primary ring-primary/15';
    }

    return 'bg-muted text-muted-foreground ring-border/70';
};

const buildMetaParts = (activity: LoginActivity): string[] => {
    const method = getMethodLabel(activity.provider);
    const ip = cleanIpAddress(activity.ipAddr);
    const parts: string[] = [];

    if (method) {
        parts.push(`via ${method}`);
    }
    if (ip) {
        parts.push(ip);
    }

    return parts;
};

const LoginActivitiesPanel = () => {
    const { data, isLoading, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage } = useInfiniteQuery({
        queryKey: ['account', 'login-activities'],
        queryFn: ({ pageParam = 0, signal }) =>
            accountApi.listLoginActivities({ page: pageParam as number, size: PAGE_SIZE }, { signal }),
        initialPageParam: 0,
        getNextPageParam: (lastPage) => {
            const { page, totalPages } = lastPage.pageInfo;

            return totalPages - page > 1 ? page + 1 : undefined;
        },
    });

    const groups = useMemo(
        () => (data?.pages.flatMap((p) => p.values) ?? []).filter((group) => group.activities.length > 0),
        [data],
    );

    const currentRequestId = useMemo(() => {
        const currentUserAgent = typeof navigator === 'undefined' ? '' : navigator.userAgent;

        if (!currentUserAgent) {
            return null;
        }

        const match = groups.find((group) => {
            const activity = group.activities[0];

            return activity.status === 'success' && String(activity.userAgent) === currentUserAgent;
        });

        return match?.requestId ?? null;
    }, [groups]);

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading: isFetchingNextPage,
        hasMore: hasNextPage,
        itemsLength: groups.length,
        onLoadMore: fetchNextPage,
    });

    const renderRowIcon = (isFailed: boolean, DeviceIcon: LucideIcon) => {
        if (isFailed) {
            return <ShieldAlert className="size-5" />;
        }

        return <DeviceIcon className="size-5" />;
    };

    const renderCurrentBadge = (isCurrent: boolean) => {
        if (!isCurrent) {
            return null;
        }

        return (
            <Badge variant="secondary" className="border-transparent bg-primary/10 px-2 py-0.5 text-primary">
                This device
            </Badge>
        );
    };

    const renderReason = (activity: LoginActivity, isFailed: boolean) => {
        if (!isFailed || !activity.reason) {
            return null;
        }

        return <span className="text-xs text-red-600 dark:text-red-400">{activity.reason}</span>;
    };

    const renderMeta = (parts: string[]) => {
        if (parts.length === 0) {
            return <span>Unknown device</span>;
        }

        return <span className="text-xs text-muted-foreground">{parts.join(' · ')}</span>;
    };

    const renderRow = (group: LoginActivityGroup) => {
        const activity = group.activities[0];
        const parsed = parseUserAgent(String(activity.userAgent));
        const DeviceIcon: LucideIcon = parsed.isMobile ? Smartphone : Monitor;
        const isFailed = getOutcome(activity) === 'failed';
        const isCurrent = group.requestId === currentRequestId;
        const deviceLabel = `${parsed.browser} on ${parsed.os}`;
        const metaParts = buildMetaParts(activity);

        return (
            <li
                key={group.requestId}
                className="login-activities-panel-list-item flex flex-wrap items-start gap-4 rounded-xl bg-card p-4 shadow-none transition-colors hover:border-primary/20 sm:flex-nowrap"
            >
                <span
                    className={cn(
                        'flex size-11 shrink-0 items-center justify-center rounded-xl ring-1',
                        getDeviceIconClassName(isFailed, isCurrent),
                    )}
                    aria-hidden
                >
                    {renderRowIcon(isFailed, DeviceIcon)}
                </span>

                <div className="login-activities-panel-list-item-content flex min-w-0 flex-1 flex-col">
                    <div className="login-activities-panel-list-item-content-header flex min-w-0 flex-wrap items-center gap-2">
                        <span className="truncate text-sm font-medium" title={String(activity.userAgent)}>
                            {deviceLabel}
                        </span>
                        {renderCurrentBadge(isCurrent)}
                    </div>
                    <div className="login-activities-panel-list-item-content-meta text-sm text-muted-foreground">
                        {renderMeta(metaParts)}
                    </div>
                    {renderReason(activity, isFailed)}
                </div>

                <div
                    className={cn(
                        'login-activities-panel-list-item-content-footer order-last flex w-full items-center justify-between gap-3 border-t border-border/60 pt-3',
                        'sm:order-0 sm:w-auto sm:shrink-0 sm:flex-col sm:items-end sm:justify-start sm:border-t-0 sm:pt-0 sm:text-right',
                    )}
                >
                    <Badge variant="secondary" className={getOutcomeClassName(activity)}>
                        {getOutcomeLabel(activity)}
                    </Badge>
                    <div
                        className="flex items-center gap-1.5 text-xs whitespace-nowrap text-muted-foreground"
                        title={formatDateTime(activity.createdAt)}
                    >
                        <CalendarDays className="size-3.5" />
                        {formatRelativeTime(activity.createdAt)}
                    </div>
                </div>
            </li>
        );
    };

    const SKELETON_LABEL_WIDTHS = ['w-40', 'w-52', 'w-36', 'w-48'];
    const SKELETON_META_WIDTHS = ['w-28', 'w-36', 'w-24', 'w-32'];

    const renderSkeletonRow = (index: number) => (
        <li key={`login-skeleton-${index}`} className="flex items-start gap-4 rounded-xl bg-card p-4">
            <Skeleton className="size-11 shrink-0 rounded-xl" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className={`h-4 rounded-sm ${SKELETON_LABEL_WIDTHS[index % SKELETON_LABEL_WIDTHS.length]}`} />
                <Skeleton className={`h-3.5 rounded-sm ${SKELETON_META_WIDTHS[index % SKELETON_META_WIDTHS.length]}`} />
            </div>
            <div className="flex shrink-0 flex-col items-end gap-2">
                <Skeleton className="h-5 w-16 rounded-md" />
                <Skeleton className="h-3 w-20 rounded-sm" />
            </div>
        </li>
    );

    const renderLoading = () => (
        <Card className="login-activities-panel-list border-border/70 bg-muted/20 pt-0 shadow-none">
            <ul className="login-activities-panel-list-content flex flex-col gap-3">
                {Array.from({ length: SKELETON_ROWS }, (_, index) => renderSkeletonRow(index))}
            </ul>
        </Card>
    );

    const renderList = () => (
        <Card className="login-activities-panel-list border-border/70 bg-muted/20 pt-0 shadow-none">
            <ul className="login-activities-panel-list-content flex flex-col gap-3">{groups.map(renderRow)}</ul>
        </Card>
    );

    const renderEmpty = () => (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-muted/20 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground">
                <History className="size-6" />
            </span>
            <span className="text-base font-medium">No login activity yet</span>
            <p className="text-sm text-muted-foreground">Recent sign-ins to your account will appear here.</p>
        </div>
    );

    const renderErrorState = () => (
        <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-destructive/30 bg-destructive/5 px-6 py-14 text-center">
            <span className="flex size-12 items-center justify-center rounded-xl bg-destructive/10 text-destructive">
                <ShieldAlert className="size-6" />
            </span>
            <span className="text-base font-medium">Couldn’t load login activity</span>
            <p className="text-sm text-muted-foreground">
                {error instanceof Error ? error.message : 'Please try again later.'}
            </p>
        </div>
    );

    const renderBody = () => {
        if (isLoading) {
            return renderLoading();
        }
        if (isError) {
            return renderErrorState();
        }
        if (groups.length === 0) {
            return renderEmpty();
        }

        return renderList();
    };

    return (
        <div className="login-activities-panel mx-auto flex w-full max-w-4xl flex-col gap-6">
            <div className="login-activities-panel-header flex flex-col gap-1">
                <h2 className="text-2xl font-semibold tracking-tight">Login activity</h2>
                <p className="text-sm text-muted-foreground">
                    Review recent sign-ins to your account. If you don’t recognize one, contact your administrator.
                </p>
            </div>
            {renderBody()}
            <InfiniteScrollTrigger isLoading={isFetchingNextPage} hasMore={hasNextPage} loadMoreRef={loadMoreRef} />
        </div>
    );
};

export default LoginActivitiesPanel;
