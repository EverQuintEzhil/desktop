import type { LucideIcon } from 'lucide-react';

import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';

import { FOCUS_RING_CLASSES, ROW_LABEL_CLASSES, ROW_LABEL_ICON_CLASSES } from '../constants';

interface Props {
    icon: LucideIcon;
    text: string;
    /** Explains the row, reachable from the leading icon by pointer and by keyboard. */
    hint: string;
    /** The off-screen measurement copy: same box, but never a focus target or a second tooltip. */
    isMeasurement?: boolean;
}

const CapabilityRowLabel = ({ icon: Icon, text, hint, isMeasurement = false }: Props) => {
    const renderIcon = () => <Icon className={ROW_LABEL_ICON_CLASSES} />;

    const renderHintTrigger = () => {
        if (isMeasurement) return renderIcon();

        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger
                        type="button"
                        aria-label={hint}
                        className={cn('flex cursor-help items-center rounded-sm', FOCUS_RING_CLASSES)}
                    >
                        {renderIcon()}
                    </TooltipTrigger>
                    <TooltipContent side="top" className="pointer-events-none! z-52 max-w-64">
                        {hint}
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    return (
        <span className={ROW_LABEL_CLASSES}>
            {renderHintTrigger()}
            {text}
        </span>
    );
};

export default CapabilityRowLabel;
