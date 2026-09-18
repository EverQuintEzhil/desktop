import { cn } from '@/lib/utils';

interface AssistantAvatarProps {
    logoSrc?: string;
    /** Light-on-dark artwork shown in dark mode instead of `logoSrc` (CSS swap, no re-render on theme flip). */
    logoSrcDark?: string;
    name?: string;
    className?: string;
}

const AssistantAvatar = ({ logoSrc, logoSrcDark, name, className }: AssistantAvatarProps) => (
    <div className={className}>
        <img
            className={cn('size-full rounded-sm object-contain', logoSrcDark && 'dark:hidden')}
            src={logoSrc}
            alt={name}
        />
        {logoSrcDark ? (
            <img className="hidden size-full rounded-sm object-contain dark:block" src={logoSrcDark} alt={name} />
        ) : null}
    </div>
);

export default AssistantAvatar;
