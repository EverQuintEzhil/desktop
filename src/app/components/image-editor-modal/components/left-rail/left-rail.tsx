import { CropIcon, FunnelIcon, type LucideIcon, SlidersVerticalIcon } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import type { ActiveMode, Mode } from '../../types';

import './left-rail.scss';

export interface LeftRailProps {
    activeMode: ActiveMode;
    onToggleMode: (mode: Mode) => void;
}

export const LeftRail = (props: LeftRailProps) => {
    const { activeMode, onToggleMode } = props;

    const modeConfig: Record<Mode, { label: string; icon: LucideIcon }> = {
        crop: { label: 'Crop', icon: CropIcon },
        adjust: { label: 'Adjust', icon: SlidersVerticalIcon },
        filters: { label: 'Filter', icon: FunnelIcon },
    };

    return (
        <div
            className={cn(
                'left-rail flex flex-col gap-2 border-r border-border-secondary px-2 py-3',
                'max-lg:sticky max-lg:bottom-0 max-lg:z-5 max-lg:flex-row max-lg:justify-center max-lg:gap-3',
                'max-lg:border-t max-lg:border-r-0 max-lg:border-t-(--border-secondary)',
            )}
        >
            {(['crop', 'adjust', 'filters'] as Mode[]).map((mode) => {
                const { label, icon } = modeConfig[mode];
                const IconComponent = icon;

                return (
                    <Button
                        key={mode}
                        size="sm"
                        variant="outline"
                        className={`mode-button flex h-auto flex-col px-1 py-2 ${activeMode === mode ? 'active' : ''}`}
                        onClick={() => onToggleMode(mode)}
                        aria-pressed={activeMode === mode}
                        aria-label={`${label} mode`}
                    >
                        <IconComponent />
                        {label}
                    </Button>
                );
            })}
        </div>
    );
};
