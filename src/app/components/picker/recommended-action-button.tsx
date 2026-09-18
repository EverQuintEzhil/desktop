import { StarIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import { actionBase } from './picker-shared';

export interface RecommendedActionButtonProps {
    isRecommended: boolean;
    onChange: (isRecommended: boolean) => void;
}

export const RecommendedActionButton = ({ isRecommended, onChange }: RecommendedActionButtonProps) => (
    <button
        className={cn(
            actionBase,
            isRecommended
                ? 'flex items-center justify-center gap-2'
                : 'border border-[color-mix(in_srgb,var(--primary)_24%,var(--border))] bg-(--surface) text-primary',
        )}
        onClick={() => onChange(!isRecommended)}
    >
        {isRecommended && <StarIcon size={15} fill="currentColor" aria-hidden="true" />}
        {isRecommended ? 'Recommended' : 'Set as recommended'}
    </button>
);
