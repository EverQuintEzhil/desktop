import { useAuiState } from '@assistant-ui/react';
import { ChevronRightIcon, TelescopeIcon } from 'lucide-react';
import { type ReactNode, useEffect, useMemo, useRef } from 'react';

import { hasPendingApprovalTool } from '../utils/tool-approval-state';
import { useChatViewContext } from '../view/chat-view-context';

import {
    collectResearchContent,
    hasRenderableResearch,
    hasResearchRunStarted,
    hasUnansweredPlanGate,
    isResearchPart,
    isResearchRunActive,
    parseDeepResearchReceipt,
    readResearchRunOutcome,
    wasResearchPlanApproved,
    wasResearchPlanRejected,
} from './research-contract';
import ResearchPlanCard from './research-plan-card';
import { buildRunningStatus, buildSettledStatus, resolveResearchElapsedMs } from './research-status-line';
import { collectFaviconStrip, type ResearchFavicon } from './research-view-model';
import { useElapsedMs } from './use-elapsed-ms';

const renderLeadMark = (favicons: readonly ResearchFavicon[]) => {
    if (favicons.length === 0) return <TelescopeIcon className="size-5 shrink-0 text-muted-foreground" aria-hidden />;

    return (
        <span className="research-card-favicons flex shrink-0 -space-x-1.5" aria-hidden>
            {favicons.map((favicon) => (
                <span
                    key={favicon.id}
                    data-slot="research-favicon"
                    className="flex size-5 items-center justify-center overflow-hidden rounded-circle border border-border bg-muted text-[10px] font-medium text-muted-foreground"
                >
                    {favicon.url ? (
                        <img src={favicon.url} alt="" className="size-full object-cover" />
                    ) : (
                        favicon.siteName.charAt(0).toUpperCase()
                    )}
                </span>
            ))}
        </span>
    );
};

interface ResearchCardProps {
    indices: readonly number[];
    children: ReactNode;
}

/**
 * The inline receipt for one deep-research run: a title, a live-or-final status line, and
 * the affordance that opens the trace in the side panel.
 */
export const ResearchCard = ({ indices, children }: ResearchCardProps) => {
    const messageParts = useAuiState((s) => s.message.parts);
    const messageId = useAuiState((s) => s.message.id);
    const isMessageRunning = useAuiState((s) => s.message.status?.type === 'running');
    const persistedDurationMs = useAuiState((s) => parseDeepResearchReceipt(s.message.metadata.custom)?.durationMs);
    const { onShowResearch, activeResearchMessageId } = useChatViewContext();

    // Collected message-wide, not from this group's own indices: a part the grouping
    // excludes outright (GenUI, MCP-UI, a reconnect gate) splits the run into several
    // groups, and every one of them must still describe the whole run.
    const content = useMemo(() => collectResearchContent(messageParts), [messageParts]);
    const firstResearchIndex = useMemo(() => messageParts.findIndex(isResearchPart), [messageParts]);

    const isRunning = isResearchRunActive(messageParts, isMessageRunning, content);
    const elapsedMs = useElapsedMs(isRunning, content.startedAt, content.reportedElapsedMs);
    const isPrimaryGroup = indices.includes(firstResearchIndex);
    const isPanelShowingThisRun = activeResearchMessageId === messageId;

    // The panel holds a snapshot, so a run the user opened mid-flight has to be re-pushed
    // as later phases stream in.
    useEffect(() => {
        if (isPrimaryGroup && isPanelShowingThisRun) onShowResearch(messageId, content, isRunning);
    }, [isPrimaryGroup, isPanelShowingThisRun, messageId, content, isRunning, onShowResearch]);

    // Claude opens the report by itself the moment it is ready — but never while the run is
    // still searching. Only for a run watched live: a finished conversation reopened from
    // history must stay as the reader left it, so the transition has to be observed, not
    // inferred from a settled run being on screen.
    //
    // Both refs hold the message id rather than a flag. `ThreadPrimitive.Messages` keys message
    // components by INDEX, so this instance and its refs are reused when the reader switches
    // conversation or branch — a bare boolean would carry "watched running" onto whatever run
    // lands at the same index and force its report open.
    const watchedRunningIdRef = useRef<string | undefined>(undefined);
    const openedReportForRef = useRef<string | undefined>(undefined);

    // Only meaningful once the run has settled — a call still in flight has no result either.
    const runOutcome = isRunning ? undefined : readResearchRunOutcome(messageParts);

    // `reportMarkdown` is only "text after the last research part", so a cancelled plan's one-line
    // acknowledgement — or a failed run's apology — qualifies as a report.
    const isReportOpenable =
        !wasResearchPlanRejected(messageParts) &&
        hasResearchRunStarted(content) &&
        runOutcome === undefined &&
        content.reportMarkdown !== undefined;

    useEffect(() => {
        if (!isPrimaryGroup) return;

        if (isRunning) {
            watchedRunningIdRef.current = messageId;

            return;
        }

        if (watchedRunningIdRef.current !== messageId) return;
        if (!isReportOpenable) return;
        if (openedReportForRef.current === messageId) return;

        openedReportForRef.current = messageId;
        onShowResearch(messageId, content, false, 'report');
    }, [isPrimaryGroup, isRunning, isReportOpenable, content, messageId, onShowResearch]);

    // A group can form around interleaved tool/reasoning parts before the first phase lands;
    // that run is not a research run yet, so it renders as it would have unwrapped.
    if (!hasRenderableResearch(content, isMessageRunning)) return <>{children}</>;

    // Only the group holding the run's first phase draws the card. A later group is a split
    // run, and its children are real tool and reasoning subtrees — one of them may be a
    // pending approval, so they are rendered unwrapped rather than dropped.
    if (!isPrimaryGroup) return <>{children}</>;

    // A tool call that lands between two phases is nested into this group, and the card cannot
    // summarise every one of them away. An approval-gated call would leave the run paused with no
    // way to answer it, and a failed run tool carries the error text the card's line cannot. A
    // stopped call has no result at all, so the line "Research stopped" is the whole of it.
    const nestedParts = hasPendingApprovalTool(indices, messageParts) || runOutcome === 'failed' ? children : null;

    // A cancelled plan is described entirely by the gate's own receipt. Drawing the run's card
    // too would repeat the plan and imply a run that never happened.
    if (wasResearchPlanRejected(messageParts)) return <>{nestedParts}</>;

    // Until the run starts, an unanswered gate owns the message — the plan, the actions, and before
    // the plan exists its "Preparing the research plan…" shell; the backend announces `planning`
    // ahead of the plan, so the card would otherwise sit above that shell saying the same thing.
    // Scoped to an unstarted run: the model may propose a second plan after a finished one, and
    // that gate must not erase the first run's card. The gate itself is a root part, never one of
    // these children, which are the interleaved reasoning and tool subtrees.
    if (hasUnansweredPlanGate(messageParts) && !hasResearchRunStarted(content)) return <>{children}</>;

    // Once the reader has approved, the run is committed: the plan card would only repeat the
    // steps they just read, so the compact card takes over and waits for the first phase.
    const isGateApproved = wasResearchPlanApproved(messageParts);

    // The phase is read off the payload, never off local state or a timer: a remount mid-run
    // must land in the same phase the parts describe.
    if (content.queryGroups.length === 0 && content.planQueries.length > 0 && !isGateApproved) {
        return (
            <>
                <ResearchPlanCard
                    content={content}
                    isRunning={isRunning}
                    onOpenTrace={() => onShowResearch(messageId, content, isRunning, 'trace')}
                />
                {nestedParts}
            </>
        );
    }

    const durationMs = resolveResearchElapsedMs(content, elapsedMs, persistedDurationMs);
    // A settled outcome always wins: status parts are never persisted, so on reload an approved run
    // that stopped before its first phase looks exactly like one about to start. Between approval
    // and that first phase the last status still reads "Waiting for you to start" and the clock is
    // anchored at the gate, so a live run says only that it is starting.
    const resolveStatus = (): string => {
        if (runOutcome !== undefined) return buildSettledStatus(content, durationMs, runOutcome);
        if (isGateApproved && !hasResearchRunStarted(content) && isMessageRunning) return 'Starting the research';
        if (isRunning) return buildRunningStatus(content, elapsedMs);

        return buildSettledStatus(content, durationMs, runOutcome);
    };
    const status = resolveStatus();

    const card = (
        <button
            type="button"
            data-slot="research-card"
            data-phase="trace"
            aria-label={`Open research trace: ${content.title}`}
            onClick={() => onShowResearch(messageId, content, isRunning, 'trace')}
            className="research-card flex w-full cursor-pointer items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 text-left transition-colors duration-140 hover:border-muted-foreground/40"
        >
            {renderLeadMark(collectFaviconStrip(content))}
            <span className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="truncate text-sm font-medium text-foreground">{content.title}</span>
                <span className="truncate text-xs text-muted-foreground tabular-nums">{status}</span>
            </span>
            <ChevronRightIcon className="size-4 shrink-0 text-muted-foreground" aria-hidden />
        </button>
    );

    return (
        <>
            {card}
            {nestedParts}
        </>
    );
};
