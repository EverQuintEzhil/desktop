import { EyeIcon } from 'lucide-react';

import { cn } from '@/lib/utils';
import type { Role } from '@/types/store';
import { isAdminPermittedUser } from '@/utils/permissions';

/**
 * Learned hints are admin-visible only: an end user is told their admin can see them
 * instead of being shown the stored docs. Deny by default — an unknown role (a `null`
 * normalized from an unexpected payload) is treated as an end user, never as an admin.
 */
export const isLearnedHintHiddenFrom = (kind: string | undefined, role: Role): boolean =>
    kind === 'learned_hint' && !isAdminPermittedUser(role);

export const LearnedHintDocsNotice = ({ className }: { className?: string }) => (
    <div className={cn('learned-hint-docs-notice flex flex-col items-center gap-3 px-4 py-10 text-center', className)}>
        <span
            className={cn(
                'flex size-11 items-center justify-center rounded-[14px]',
                'bg-[color-mix(in_srgb,var(--primary)_8%,var(--surface))] text-primary',
                'border border-[color-mix(in_srgb,var(--primary)_14%,var(--border))]',
            )}
        >
            <EyeIcon size={18} aria-hidden="true" />
        </span>
        <div className="flex flex-col gap-1">
            <span className="text-sm font-semibold text-(--text-primary)">Only your admin can view these</span>
            <span className="max-w-[300px] text-xs leading-normal text-text-secondary">
                Hints we learn about you aren&apos;t listed here — your workspace admin can view them.
            </span>
        </div>
    </div>
);
