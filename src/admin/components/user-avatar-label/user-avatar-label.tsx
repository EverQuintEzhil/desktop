import Avatar from '@/components/ui/avatar';
import type { WireUserRow } from '@/lib/api/admin/insights-schema';
import { getFilesDownloadUrl } from '@/lib/axios';
import { cn } from '@/lib/utils';

const DEFAULT_AVATAR_PLACEHOLDER = 'https://assets.hub.perkinswill.com/default-user.svg';

export const formatUserName = (name: WireUserRow['name']): string =>
    (name ? [name.first, name.last].filter(Boolean).join(' ') : '') || 'Unnamed user';

interface Props {
    name: string;
    avatar: string | null;
    subtitle?: string;
    className?: string;
}

const UserAvatarLabel = ({ name, avatar, subtitle, className }: Props) => {
    return (
        <div className={cn('flex min-w-0 items-center gap-2', className)}>
            {avatar ? (
                <Avatar alt={name} src={getFilesDownloadUrl(avatar)} placeholder={DEFAULT_AVATAR_PLACEHOLDER} />
            ) : (
                <Avatar alt={name} initials />
            )}
            <div className="flex min-w-0 flex-col">
                <span className="truncate text-sm">{name}</span>
                {subtitle && <span className="truncate text-xs text-text-secondary">{subtitle}</span>}
            </div>
        </div>
    );
};

export default UserAvatarLabel;
