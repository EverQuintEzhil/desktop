import { PackageIcon, XIcon } from 'lucide-react';

import { cn } from '@/lib/utils';

import type { NamedItem } from '../types';

export interface SkillChipProps {
    skill: NamedItem;
    onRemove: (skill: NamedItem) => void;
    onViewSkill: (skillId: string) => void;
}

const SkillChip = ({ skill, onRemove, onViewSkill }: SkillChipProps) => (
    <span
        className={cn(
            'group/chip inline-flex h-7 items-center gap-1.5 rounded-full pr-3 pl-2 text-sm whitespace-nowrap text-(--text-primary)',
            'border border-[color-mix(in_srgb,var(--border)_86%,var(--primary))] bg-[color-mix(in_srgb,var(--primary)_4%,var(--surface))]',
            'transition-[border-color] duration-140 hover:border-[color-mix(in_srgb,var(--primary)_32%,var(--border))]',
        )}
    >
        <button
            type="button"
            className={cn(
                'group/remove inline-flex size-4 shrink-0 cursor-pointer items-center justify-center rounded-full border-none bg-transparent p-0',
                'group-hover/chip:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)]',
                'focus-visible:bg-[color-mix(in_srgb,var(--danger)_12%,transparent)] focus-visible:outline-none',
            )}
            aria-label={`Remove ${skill.name}`}
            onClick={() => onRemove(skill)}
        >
            <PackageIcon
                className="shrink-0 group-hover/chip:hidden group-focus-visible/remove:hidden"
                size={12}
                color="var(--primary)"
                aria-hidden="true"
            />
            <XIcon
                className="hidden text-(--danger) group-hover/chip:block group-focus-visible/remove:block"
                size={12}
                aria-hidden="true"
            />
        </button>
        <button
            type="button"
            className={cn(
                'cursor-pointer border-none bg-transparent p-0 font-[inherit] text-(--text-primary)',
                'transition-[color] duration-140 hover:text-primary focus-visible:text-primary focus-visible:underline focus-visible:outline-none',
                'max-w-[160px] overflow-hidden text-ellipsis whitespace-nowrap',
            )}
            onClick={() => onViewSkill(skill._id)}
        >
            {skill.name}
        </button>
    </span>
);

export default SkillChip;
