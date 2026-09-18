import { BranchPickerPrimitive, useAuiState } from '@assistant-ui/react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

import { Button } from '@/components/ui/button';

export const MessageBranchPicker = () => {
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const isLast = useAuiState((s) => s.message.isLast);
    const isHovering = useAuiState((s) => s.message.isHovering);

    if (isRunning && isLast) return null;
    if (!isLast && !isHovering) return null;

    return (
        <BranchPickerPrimitive.Root
            hideWhenSingleBranch
            className="message-branch-picker inline-flex shrink-0 items-center gap-0.5"
        >
            <BranchPickerPrimitive.Previous asChild>
                <Button
                    size="icon-xs"
                    variant="ghost"
                    className="justify-center"
                    disabled={isRunning}
                    aria-label="Previous branch"
                >
                    <ChevronLeft />
                </Button>
            </BranchPickerPrimitive.Previous>
            <span className="text-xs font-medium text-muted-foreground tabular-nums">
                <BranchPickerPrimitive.Number />
                {' / '}
                <BranchPickerPrimitive.Count />
            </span>
            <BranchPickerPrimitive.Next asChild>
                <Button
                    size="icon-xs"
                    variant="ghost"
                    className="justify-center"
                    disabled={isRunning}
                    aria-label="Next branch"
                >
                    <ChevronRight />
                </Button>
            </BranchPickerPrimitive.Next>
        </BranchPickerPrimitive.Root>
    );
};
