import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { cn } from '@/lib/utils';
import type { ConversationStatus } from '@/types/chat';

import { CONVERSATION_STATUS_MARKS, resolveConversationStatusMark } from './constants';

export interface Props {
    status?: ConversationStatus;
    /** Answered since the reader last opened it. Outranks a plainly settled turn. */
    isUnread?: boolean;
    /** Marks a plainly finished conversation too, for short lists that can afford it. */
    showSettled?: boolean;
    /** Drops the fixed-width empty slot, for rows that do not need their titles aligned. */
    collapseWhenEmpty?: boolean;
    className?: string;
}

// Leading status mark for a conversation row. Always renders a fixed-width slot so
// titles stay aligned whether or not a row has anything to say.
const ConversationStatusIndicator = ({ status, isUnread, showSettled, collapseWhenEmpty, className }: Props) => {
    const mark = resolveConversationStatusMark({ status, isUnread, showSettled });

    if (!mark) {
        return collapseWhenEmpty ? null : <span className="size-4 shrink-0" aria-hidden />;
    }

    const { label, className: markClassName } = CONVERSATION_STATUS_MARKS[mark];

    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <span aria-label={label} className={cn('flex size-4 shrink-0 items-center justify-center', className)}>
                    <span className={cn('size-2 rounded-full', markClassName)} aria-hidden />
                </span>
            </TooltipTrigger>
            <TooltipContent side="bottom">{label}</TooltipContent>
        </Tooltip>
    );
};

export default ConversationStatusIndicator;
