import {
    CircleAlertIcon,
    CircleCheckIcon,
    CircleSlashIcon,
    ExternalLinkIcon,
    LoaderCircleIcon,
    PlugZapIcon,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import ConversationStatusIndicator from '@/app/components/conversation-status-indicator';
import { useNotificationsRoutineRuns } from '@/app/components/routine-runs';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';
import { NEEDS_RECONNECT_RUN_REASON, SKIPPED_RUN_REASON, type RoutineRunType } from '@/types/routines';

import { useChatSidePanel } from '../conversation-files/chat-files-panel-context';
import ChatSidePaneShell from '../conversation-files/chat-side-pane-shell';

import { useConversationRoutine } from './use-conversation-routine';

interface Props {
    agent: ChatAgentType;
    conversationId?: string;
}

const runIcon = (status: RoutineRunType['status']) => {
    if (status === 'running') {
        return <LoaderCircleIcon aria-hidden="true" className="size-3.5 animate-spin text-muted-foreground" />;
    }
    if (status === 'failed') {
        return <CircleAlertIcon aria-hidden="true" className="size-3.5 text-destructive" />;
    }
    if (status === 'needs_reconnect') {
        return <PlugZapIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />;
    }
    if (status === 'skipped') {
        return <CircleSlashIcon aria-hidden="true" className="size-3.5 text-muted-foreground" />;
    }

    return <CircleCheckIcon aria-hidden="true" className="size-3.5 text-success" />;
};

const isToday = (date: Date, now: Date): boolean => date.toDateString() === now.toDateString();

const isYesterday = (date: Date, now: Date): boolean => {
    const yesterday = new Date(now);

    yesterday.setDate(yesterday.getDate() - 1);

    return date.toDateString() === yesterday.toDateString();
};

const runLabel = (run: RoutineRunType): string => {
    const started = new Date(run.startedAt);

    if (Number.isNaN(started.getTime())) return 'Run';

    const now = new Date();
    const time = started.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });

    if (isToday(started, now)) return `Run — today at ${time}`;
    if (isYesterday(started, now)) return `Run — yesterday at ${time}`;

    return `Run — ${started.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${time}`;
};

/**
 * The reason a run produced nothing — a reconnect it is waiting on, or the skip it was given.
 *
 * Prose only, no reconnect button: chat already answers a dead connector with its own inline
 * reconnect card, which a second button on the same screen can contradict, and this list is per run
 * so one connector's fix would stack a button per failed run. The routines detail screen is where
 * that button lives.
 */
const inertRunReasonOf = (run: RoutineRunType): string | null => {
    if (run.status === 'needs_reconnect') return run.error || NEEDS_RECONNECT_RUN_REASON;
    if (run.status !== 'skipped') return null;

    return run.error ? `Skipped — ${run.error}` : SKIPPED_RUN_REASON;
};

const ConversationRoutinePane = ({ agent, conversationId }: Props) => {
    const { activePane, close } = useChatSidePanel();
    const navigate = useNavigate();
    const { unreadRunIds, markRead } = useNotificationsRoutineRuns();
    const { routine, isResolving } = useConversationRoutine(conversationId);
    const isOpen = activePane === 'routine';

    if (!routine && !isResolving) return null;

    // Switching runs re-keys the feed query; unmounting here would blank the pane for that frame.
    if (!routine) {
        return (
            <ChatSidePaneShell isOpen={isOpen} title="Routine" onClose={close}>
                <div className="flex flex-col gap-2 px-3">
                    <Skeleton className="h-8 w-full rounded-lg" />
                    <Skeleton className="h-8 w-full rounded-lg" />
                    <Skeleton className="h-8 w-full rounded-lg" />
                </div>
            </ChatSidePaneShell>
        );
    }

    const renderRun = (run: RoutineRunType) => {
        const isCurrent = run._id === routine.currentRunId;
        // A run in flight is watchable: its conversation exists from the outset and streams.
        const canOpen = Boolean(run.conversationId);
        const inertReason = inertRunReasonOf(run);

        return (
            <li key={run._id}>
                <button
                    type="button"
                    disabled={!canOpen || isCurrent}
                    className={cn(
                        'flex w-full items-start gap-2 rounded-lg px-3 py-2 text-left text-sm',
                        'focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:outline-none',
                        isCurrent && 'bg-muted font-medium',
                        canOpen && !isCurrent && 'cursor-pointer hover:bg-accent',
                    )}
                    onClick={() => {
                        if (unreadRunIds.has(run._id)) markRead([run._id]);
                        navigate(`/agent/${agent.slug}/chat/${run.conversationId}`);
                    }}
                >
                    <span className="mt-0.5 shrink-0">{runIcon(run.status)}</span>
                    <span className="flex min-w-0 flex-1 flex-col">
                        <span className="truncate">{runLabel(run)}</span>
                        {inertReason ? (
                            <span className="text-xs font-normal text-muted-foreground">{inertReason}</span>
                        ) : null}
                    </span>
                    <ConversationStatusIndicator isUnread={unreadRunIds.has(run._id)} collapseWhenEmpty />
                </button>
            </li>
        );
    };

    return (
        <ChatSidePaneShell isOpen={isOpen} title={routine.routineName} onClose={close}>
            <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full justify-center"
                onClick={() => navigate(`/agent/${agent.slug}/routines`)}
            >
                <ExternalLinkIcon aria-hidden="true" className="size-3.5" />
                Open routine
            </Button>

            <div className="flex flex-col gap-1">
                <h5 className="px-3 text-xs font-medium text-muted-foreground">Runs</h5>
                <ul className="flex flex-col">{routine.runs.map(renderRun)}</ul>
            </div>
        </ChatSidePaneShell>
    );
};

export default ConversationRoutinePane;
