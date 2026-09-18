import { EyeIcon, EyeOffIcon, RotateCcwIcon, XIcon } from 'lucide-react';
import { useState, useEffect, type ReactNode } from 'react';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';

import { useEditorContext } from '../../context/editor-context';
import type { ActiveMode } from '../../types';

import './side-panel.scss';

export interface SidePanelProps {
    activeMode: ActiveMode;
    onClose: () => void;
    selectedFilterLabel?: string | null;
    onResetFilters: () => void;
    onToggleFilter: () => void;
    onResetAdjustments: () => void;
    onToggleAdjustments: () => void;
    children: ReactNode;
}

export const SidePanel = (props: SidePanelProps) => {
    const { activeMode, onClose, onResetFilters, onToggleFilter, onResetAdjustments, onToggleAdjustments, children } =
        props;
    const { filterEnabled, adjustmentsEnabled } = useEditorContext();
    const [isExpanded, setIsExpanded] = useState(false);

    useEffect(() => {
        if (activeMode) {
            setIsExpanded(true);
        } else {
            setIsExpanded(false);
        }
    }, [activeMode]);

    const handleClose = () => {
        setIsExpanded(false);
        onClose();
    };

    if (!activeMode) return null;

    const titleMap: Record<Exclude<ActiveMode, null>, string> = {
        crop: 'Crop',
        adjust: 'Adjustments',
        filters: 'Filter',
    };

    const title = titleMap[activeMode as Exclude<ActiveMode, null>];

    const renderFilterActions = () => {
        if (activeMode !== 'filters') return null;

        return (
            <>
                <Button size="icon-xs" variant="outline" onClick={onResetFilters} aria-label="Reset filter">
                    <RotateCcwIcon />
                </Button>
                <SimpleTooltip content={filterEnabled ? 'Disable filter' : 'Enable filter'} side="bottom">
                    <Button
                        size="icon-xs"
                        variant="outline"
                        onClick={onToggleFilter}
                        aria-label={filterEnabled ? 'Disable filter' : 'Enable filter'}
                    >
                        {filterEnabled ? <EyeIcon /> : <EyeOffIcon />}
                    </Button>
                </SimpleTooltip>
            </>
        );
    };

    const renderAdjustmentActions = () => {
        if (activeMode !== 'adjust') return null;

        return (
            <>
                <Button size="icon-xs" variant="outline" onClick={onResetAdjustments} aria-label="Reset adjustments">
                    <RotateCcwIcon />
                </Button>
                <SimpleTooltip
                    content={adjustmentsEnabled ? 'Disable adjustments' : 'Enable adjustments'}
                    side="bottom"
                >
                    <Button
                        size="icon-xs"
                        variant="outline"
                        onClick={onToggleAdjustments}
                        aria-label={adjustmentsEnabled ? 'Disable adjustments' : 'Enable adjustments'}
                    >
                        {adjustmentsEnabled ? <EyeIcon /> : <EyeOffIcon />}
                    </Button>
                </SimpleTooltip>
            </>
        );
    };

    const wrapperClassName = [
        'side-panel-wrapper',
        'scrollbar-vertical',
        'scrollbar-controller',
        'flex flex-col min-h-0',
        isExpanded && 'is-expanded',
    ]
        .filter(Boolean)
        .join(' ');

    return (
        <div className={wrapperClassName} onClick={() => !isExpanded && setIsExpanded(true)}>
            <div
                className="side-panel-header sticky top-0 z-4 flex items-center justify-between px-3.5 py-3"
                onClick={() => !isExpanded && setIsExpanded(true)}
            >
                <span className="font-medium">{title}</span>
                <div className="side-panel-actions flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    {renderFilterActions()}
                    {renderAdjustmentActions()}
                    <Button size="icon-xs" variant="outline" onClick={handleClose} aria-label="Close panel">
                        <XIcon />
                    </Button>
                </div>
            </div>
            <div className="side-panel-content flex-1 py-4">{children}</div>
        </div>
    );
};
