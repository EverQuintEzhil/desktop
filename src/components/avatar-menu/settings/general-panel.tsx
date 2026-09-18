import { useQuery } from '@tanstack/react-query';
import { capitalize } from 'lodash';
import { CalendarDays, Clock, Globe, Mail, Phone, ShieldCheck } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import Avatar from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { useAppSelector } from '@/hooks';
import { accountApi, ME_QUERY_KEY, type MeProfile } from '@/lib/api';
import { getFilesDownloadUrl } from '@/lib/axios';
import { cn } from '@/lib/utils';
import { selectTenant } from '@/store/selectors';
import { formatDate } from '@/utils/date';

import ProfileFieldsSection from './profile-fields-section';

const defaultPlaceholder = 'https://assets.hub.perkinswill.com/default-user.svg';

const getFullName = (name: MeProfile['name']) => {
    const first = name.first ?? '';
    const middle = name.middle ?? '';
    const last = name.last ?? '';

    return [first, middle, last].filter(Boolean).join(' ').trim();
};

const getTimezoneLabel = (profile: MeProfile): string => {
    if (!profile.timezone) {
        return '—';
    }
    if (profile.timezoneOffset) {
        return `${profile.timezone} (UTC${profile.timezoneOffset})`;
    }

    return profile.timezone;
};

interface DetailRow {
    label: string;
    value: React.ReactNode;
    Icon: LucideIcon;
}

const GeneralPanel = () => {
    const tenant = useAppSelector(selectTenant);
    const { data, isPending, error } = useQuery({
        queryKey: ME_QUERY_KEY,
        queryFn: () => accountApi.getMe(),
    });

    const renderAvatar = (avatar: string, fullName: string) => {
        if (avatar) {
            return (
                <Avatar size="lg" alt={fullName} src={getFilesDownloadUrl(avatar)} placeholder={defaultPlaceholder} />
            );
        }

        return <Avatar initials size="lg" alt={fullName} placeholder={defaultPlaceholder} />;
    };

    const renderProfileCard = (avatar: string, fullName: string, email: string, role: string) => (
        <Card
            className={cn(
                'general-panel-profile-card overflow-hidden p-4 shadow-none lg:p-6',
                'sm:flex-row sm:items-center sm:justify-between',
            )}
        >
            <div className="general-panel-profile-card-header flex min-w-0 items-center gap-4">
                <div className="rounded-full bg-primary/10 p-1 ring-1 ring-primary/10">
                    {renderAvatar(avatar, fullName)}
                </div>

                <div className="general-panel-profile-card-header-name flex min-w-0 flex-col">
                    <span className="truncate text-lg font-semibold tracking-tight">{fullName}</span>
                    <span className="truncate text-sm text-muted-foreground">{email}</span>
                </div>
            </div>

            <div className="general-panel-profile-card-role flex flex-wrap items-center justify-between gap-3 border-t border-border/70 pt-5 sm:border-t-0 sm:pt-0">
                <Badge
                    variant="secondary"
                    className="w-fit gap-1.5 border-transparent bg-primary/10 px-2.5 py-1 text-primary"
                >
                    <ShieldCheck className="size-3.5" />
                    {capitalize(role)}
                </Badge>
            </div>
        </Card>
    );

    const renderRow = (row: DetailRow) => (
        <div key={row.label} className="flex min-w-0 items-start gap-3 rounded-xl bg-card p-4 shadow-none">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                <row.Icon className="size-4" />
            </span>
            <div className="flex min-w-0 flex-1 flex-col">
                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">{row.label}</span>
                <span className="text-sm leading-6 font-medium wrap-break-word text-foreground">{row.value}</span>
            </div>
        </div>
    );

    const renderDetails = (profile: MeProfile) => {
        const rows: DetailRow[] = [
            { label: 'Email', value: profile.email || '—', Icon: Mail },
            { label: 'Mobile', value: profile.mobile || '—', Icon: Phone },
            { label: 'Default language', value: profile.defaultLanguage || '—', Icon: Globe },
            { label: 'Timezone', value: getTimezoneLabel(profile), Icon: Clock },
            { label: 'Member since', value: formatDate(profile.createdAt), Icon: CalendarDays },
        ];

        return <div className="grid gap-3 lg:grid-cols-2">{rows.map(renderRow)}</div>;
    };

    const SKELETON_LABEL_WIDTHS = ['w-16', 'w-24', 'w-32', 'w-20', 'w-28'];
    const SKELETON_VALUE_WIDTHS = ['w-44', 'w-28', 'w-20', 'w-36', 'w-32'];

    const renderSkeletonRow = (index: number) => (
        <div key={`profile-skeleton-${index}`} className="flex min-w-0 items-start gap-3 rounded-xl bg-card p-4">
            <Skeleton className="size-10 shrink-0 rounded-lg" />
            <div className="flex min-w-0 flex-1 flex-col gap-2">
                <Skeleton className={`h-3 rounded-sm ${SKELETON_LABEL_WIDTHS[index]}`} />
                <Skeleton className={`h-4 rounded-sm ${SKELETON_VALUE_WIDTHS[index]}`} />
            </div>
        </div>
    );

    const renderLoading = () => (
        <div className="general-panel-content flex flex-col gap-6">
            <Card className="general-panel-profile-card overflow-hidden p-4 shadow-none lg:p-6">
                <div className="general-panel-profile-card-header flex min-w-0 items-center justify-between gap-4">
                    <div className="general-panel-profile-card-role flex items-center gap-3">
                        <Skeleton className="size-12 shrink-0 rounded-full" />
                        <div className="flex min-w-0 flex-col gap-2">
                            <Skeleton className="h-5 w-36 rounded-sm" />
                            <Skeleton className="h-4 w-52 max-w-full rounded-sm" />
                        </div>
                    </div>
                    <Skeleton className="h-6 w-20 rounded-md" />
                </div>
            </Card>
            <section className="general-panel-details flex flex-col gap-4">
                <div className="general-panel-details-header flex flex-col gap-1">
                    <Skeleton className="h-5 w-32 rounded-sm" />
                    <Skeleton className="h-4 w-64 rounded-sm" />
                </div>
                <div className="grid gap-3 lg:grid-cols-2">
                    {Array.from({ length: 5 }, (_, index) => renderSkeletonRow(index))}
                </div>
            </section>
        </div>
    );

    const renderError = () => (
        <div className="rounded-xl border border-dashed border-destructive/30 bg-destructive/5 p-6">
            <p className="text-sm font-medium text-destructive">
                {error instanceof Error ? error.message : 'Failed to load your profile.'}
            </p>
        </div>
    );

    const renderContent = (profile: MeProfile) => {
        const fullName = getFullName(profile.name);

        return (
            <div className="general-panel-content flex flex-col gap-6">
                {renderProfileCard(profile.avatar, fullName, profile.email, profile.role)}

                <section className="general-panel-details flex flex-col gap-4">
                    <div className="general-panel-details-header flex flex-col gap-1">
                        <h3 className="text-base font-semibold">Account details</h3>
                        <p className="text-sm text-muted-foreground">
                            {`Key information connected to your ${tenant.name} account.`}
                        </p>
                    </div>
                    {renderDetails(profile)}
                </section>

                <ProfileFieldsSection profile={profile} />
            </div>
        );
    };

    const renderBody = () => {
        if (isPending) {
            return renderLoading();
        }
        if (error || !data) {
            return renderError();
        }

        return renderContent(data);
    };

    return (
        <div className="general-panel mx-auto flex w-full max-w-4xl flex-col gap-6">
            <div className="general-panel-header flex flex-col gap-1">
                <h2 className="text-2xl font-semibold tracking-tight">General</h2>
                <p className="text-sm text-muted-foreground">Review your profile, account details, and access level.</p>
            </div>
            {renderBody()}
        </div>
    );
};

export default GeneralPanel;
