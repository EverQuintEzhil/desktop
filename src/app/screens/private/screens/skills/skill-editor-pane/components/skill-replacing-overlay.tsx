import { Loader2Icon } from 'lucide-react';

import { cn } from '@/lib/utils';

export interface Props {
    isReplacing: boolean;
}

const SkillReplacingOverlay = ({ isReplacing }: Props) => {
    if (!isReplacing) return null;

    return (
        <div
            className={cn(
                'absolute inset-0 z-100 flex flex-col items-center justify-center gap-3',
                'bg-background/80 backdrop-blur-[2px]',
            )}
            aria-live="polite"
            aria-busy="true"
            aria-label="Replacing skill"
        >
            <Loader2Icon className="size-8 animate-spin text-primary" aria-hidden="true" />
            <p className="text-sm font-medium text-foreground">Replacing skill</p>
        </div>
    );
};

export default SkillReplacingOverlay;
