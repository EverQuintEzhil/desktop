import { useAuiState } from '@assistant-ui/react';
import { useMemo } from 'react';

import { useChatViewContext } from '../view/chat-view-context';

import {
    collectResearchContent,
    hasRenderableResearch,
    isResearchRunActive,
    wasResearchPlanRejected,
} from './research-contract';

/**
 * The document card for a finished run, rendered after the message's own content rather than
 * beside the run's card: the report it opens is the last thing in the message, so the way into
 * it belongs at the end too — the shape Claude's document card has.
 */
const ResearchReportChip = () => {
    const messageParts = useAuiState((s) => s.message.parts);
    const messageId = useAuiState((s) => s.message.id);
    const isMessageRunning = useAuiState((s) => s.message.status?.type === 'running');
    const { onShowResearch } = useChatViewContext();

    const content = useMemo(() => collectResearchContent(messageParts), [messageParts]);
    const isRunning = isResearchRunActive(messageParts, isMessageRunning, content);

    // A cancelled run wrote no report — its text is the model saying so, not a document.
    if (wasResearchPlanRejected(messageParts)) return null;

    if (!hasRenderableResearch(content, isMessageRunning) || isRunning || content.reportMarkdown === undefined) {
        return null;
    }

    return (
        <button
            type="button"
            data-slot="research-report-chip"
            className="research-report-chip mt-3 flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors duration-140 hover:border-muted-foreground/40"
            onClick={() => onShowResearch(messageId, content, isRunning, 'report')}
        >
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-foreground">{content.title}</span>
                <span className="text-xs text-muted-foreground">Document</span>
            </span>
            {/* The thumbnail is the report's own first lines, as Claude's document card is —
                a picture of the text rather than a generic file icon. */}
            <span
                aria-hidden
                className="research-report-thumb hidden h-14 w-16 shrink-0 overflow-hidden rounded-sm border border-border bg-muted/60 px-1.5 py-1 text-[4px] leading-[6px] break-words text-muted-foreground sm:block"
            >
                {content.reportMarkdown.slice(0, 280)}
            </span>
        </button>
    );
};

export default ResearchReportChip;
