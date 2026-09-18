import { InfoIcon } from 'lucide-react';
import type { KeyboardEvent } from 'react';

import { Label } from '@/components/ui/label';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import Switch from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { DCR_HINT } from '@/types/admin';

const DCR_OPTIONS = [{ label: 'Yes' }, { label: 'No' }];

// Radix roving focus maps these to move focus, so the selection has to follow each of them.
const MOVE_KEYS = ['ArrowLeft', 'ArrowUp', 'ArrowRight', 'ArrowDown'];
const FIRST_KEYS = ['Home', 'PageUp'];
const LAST_KEYS = ['End', 'PageDown'];

interface Props {
    value: boolean;
    onChange: (value: boolean) => void;
}

export const DcrToggle = ({ value, onChange }: Props) => {
    // The segments expose radio semantics, so arrow keys must move the selection, not just the focus. With two
    // looping options every arrow lands on the other one, so follow the focus rather than pinning a direction.
    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        if (MOVE_KEYS.includes(event.key)) {
            onChange(!value);
        } else if (FIRST_KEYS.includes(event.key)) {
            onChange(true);
        } else if (LAST_KEYS.includes(event.key)) {
            onChange(false);
        }
    };

    return (
        <div className="dcr-toggle flex items-center justify-between gap-3">
            <div className="flex items-center gap-1.5">
                <Label id="connectorDcrLabel" className="text-sm font-medium text-text-secondary">
                    Does it support DCR?
                </Label>
                <SimpleTooltip content={DCR_HINT} side="top" sideOffset={6} className="max-w-[260px] text-wrap">
                    <button
                        type="button"
                        aria-label="About Dynamic Client Registration"
                        className={cn(
                            'flex shrink-0 cursor-help items-center rounded-full text-text-secondary',
                            'focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-(--color-focus-ring)',
                        )}
                    >
                        <InfoIcon size={14} aria-hidden="true" />
                    </button>
                </SimpleTooltip>
            </div>
            <div role="group" aria-labelledby="connectorDcrLabel" className="shrink-0" onKeyDown={handleKeyDown}>
                <Switch
                    options={DCR_OPTIONS}
                    activeIndex={value ? 0 : 1}
                    onChange={(_event, index) => onChange(index === 0)}
                    width={96}
                />
            </div>
        </div>
    );
};
