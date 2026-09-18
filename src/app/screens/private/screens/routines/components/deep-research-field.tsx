import { TelescopeIcon } from 'lucide-react';

import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

export interface Props {
    value: boolean;
    onChange: (value: boolean) => void;
}

const DeepResearchField = ({ value, onChange }: Props) => (
    <SimpleTooltip
        content={
            value
                ? 'Each run may search the web over several rounds and cite its sources.'
                : 'Let each run search the web over several rounds and cite its sources.'
        }
        side="top"
    >
        <button
            type="button"
            aria-pressed={value}
            className={cn(
                'deep-research-field flex h-7 min-w-0 shrink-0 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs transition-colors',
                value
                    ? 'bg-primary/10 text-primary hover:bg-primary/15'
                    : 'bg-muted text-(--text-secondary) hover:bg-border hover:text-(--text-primary)',
            )}
            onClick={() => onChange(!value)}
        >
            <TelescopeIcon aria-hidden="true" className="size-3.5 shrink-0" />
            <span className="truncate">Deep research</span>
        </button>
    </SimpleTooltip>
);

export default DeepResearchField;
