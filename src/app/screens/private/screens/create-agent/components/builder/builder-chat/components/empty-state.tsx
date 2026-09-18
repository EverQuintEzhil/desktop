import { BookOpenIcon, ClockIcon, PencilLineIcon } from 'lucide-react';
import type { FC, ReactNode } from 'react';

import { cn } from '@/lib/utils';

interface SuggestionItem {
    icon: ReactNode;
    label: string;
    message?: string;
}

const SUGG_EDITOR: SuggestionItem[] = [
    {
        icon: <BookOpenIcon size={14} aria-hidden="true" />,
        label: 'Add advanced logic',
        message: 'Create a skill that makes this agent more effective.',
    },
    {
        icon: <ClockIcon size={14} aria-hidden="true" />,
        label: 'Configure when the agent runs',
        message: 'How do I set up when my agent runs?',
    },
    {
        icon: <PencilLineIcon size={14} aria-hidden="true" />,
        label: 'Improve this agent',
        message: 'Help me improve this agent.',
    },
];

export interface EmptyStateProps {
    onSuggestion: (label: string) => void;
}

const EmptyState: FC<EmptyStateProps> = ({ onSuggestion }) => (
    <div className="mt-auto">
        <p className="m-0 mb-5 text-h5 leading-[1.4] font-semibold text-(--text-primary)">
            How should we improve this agent?
        </p>
        <div className="flex flex-col gap-0.5">
            {SUGG_EDITOR.map((s) => (
                <button
                    key={s.label}
                    type="button"
                    className={cn(
                        'flex cursor-pointer items-center gap-3 border-none bg-transparent px-3 py-[9px]',
                        'w-full rounded-lg text-left text-[13px] font-normal text-text-secondary',
                        'transition-[background,color] duration-140 [&_svg]:shrink-0 [&_svg]:opacity-100',
                        'hover:bg-card hover:text-primary',
                    )}
                    onClick={() => onSuggestion(s.message ?? s.label)}
                >
                    {s.icon}
                    <span>{s.label}</span>
                </button>
            ))}
        </div>
    </div>
);

export default EmptyState;
