import { BotIcon, MessagesSquareIcon, TriangleAlertIcon } from 'lucide-react';
import { useCallback, useRef } from 'react';
import { useLocation, useNavigate, useParams } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import Spinner from '@/components/ui/spinner';
import { useViewportFillHeight } from '@/hooks';
import { useAgentBySlugOrIdQuery } from '@/lib/api/admin/agents';

import Header from '../header';

import { AgentPicker, ChatDetails, Conversations } from './components';
import { BUILDER_CONVERSATIONS_PATH } from './constants';
import { clearLastSelectedAgent, useLastSelectedAgent } from './hooks';

const isRecord = (value: unknown): value is Record<string, unknown> => typeof value === 'object' && value !== null;

const BuilderConversations = () => {
    const params = useParams();
    const navigate = useNavigate();
    const location = useLocation();
    const rootRef = useRef<HTMLDivElement>(null);

    // Survives a reload, since react-router keeps it in `history.state` — so the trigger is
    // labelled on a refresh too, not just on the navigation that set it. History state is
    // writable from outside the app, so the shape is checked rather than asserted: a
    // non-string here would reach React as a child and throw.
    const routeState: unknown = location.state;
    const pendingAgentName =
        isRecord(routeState) && typeof routeState.agentName === 'string' ? routeState.agentName : undefined;

    // Both the list panel and the detail panel read the selection, so the path is parsed here
    // rather than split across two nested `Routes`.
    const [agentSlug = '', conversationId = ''] = (params['*'] ?? '').split('/');

    const { data: agent, isLoading, isError, error, refetch } = useAgentBySlugOrIdQuery(agentSlug || undefined);

    useViewportFillHeight(rootRef, { cssVar: '--builder-conversations-h' });

    const onRestoreAgent = useCallback(
        (slug: string) => {
            navigate(`${BUILDER_CONVERSATIONS_PATH}/${slug}`, { replace: true });
        },
        [navigate],
    );

    useLastSelectedAgent({
        agentSlug,
        resolvedSlug: agent?.slug ?? null,
        error,
        onRestore: onRestoreAgent,
    });

    // Selecting an agent drops the open conversation: it belongs to the agent being replaced.
    const onAgentChange = (slug: string | null, name?: string) => {
        if (!slug) {
            // Deselecting is the same explicit intent as the breadcrumb, so it forgets too.
            clearLastSelectedAgent();
            navigate(BUILDER_CONVERSATIONS_PATH);

            return;
        }

        // The name rides along so the header picker can label itself immediately instead of
        // showing the slug until the agent request resolves.
        navigate(`${BUILDER_CONVERSATIONS_PATH}/${slug}`, { state: { agentName: name } });
    };

    const renderPlaceholder = (icon: React.ReactNode, title: string, description: string, action?: React.ReactNode) => {
        return (
            <div className="builder-conversations-placeholder flex h-full flex-col items-center justify-center gap-4 bg-background px-6 text-center">
                <div className="flex size-20 items-center justify-center rounded-2xl bg-primary/10 text-primary ring-1 ring-primary/15">
                    {icon}
                </div>
                <div className="flex max-w-sm flex-col items-center gap-1.5">
                    <span className="text-base font-medium text-foreground">{title}</span>
                    <span className="text-sm leading-5 text-muted-foreground">{description}</span>
                </div>
                {action && <div className="builder-conversations-placeholder-action w-full max-w-xs">{action}</div>}
            </div>
        );
    };

    // Nothing is scoped yet, so the split view has nothing to show on either side — the whole
    // body becomes the chooser and the picker moves back into the list panel once it resolves.
    const renderAgentChooser = () => {
        return renderPlaceholder(
            <BotIcon className="size-10" />,
            'Select an agent',
            'Pick an agent to browse the conversations its builder recorded.',
            <AgentPicker selectedSlug={null} selectedAgent={null} onChange={onAgentChange} />,
        );
    };

    const renderListPanel = () => {
        return (
            <div className="builder-conversations-list-panel scrollbar-controller scrollbar-vertical flex h-full min-h-0 flex-col">
                {renderList()}
            </div>
        );
    };

    const renderList = () => {
        if (isLoading) {
            return (
                <div className="flex flex-1 items-center justify-center py-6">
                    <Spinner />
                </div>
            );
        }

        if (isError || !agent) {
            return (
                <div className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center">
                    <div className="flex size-10 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                        <TriangleAlertIcon className="size-5" aria-hidden="true" />
                    </div>
                    <div className="flex flex-col gap-1">
                        <p className="text-sm font-medium text-foreground">Couldn&apos;t load this agent</p>
                        <p className="text-xs text-muted-foreground">
                            The agent may have been deleted, or the request failed.
                        </p>
                    </div>
                    <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        className="rounded-full"
                        onClick={() => refetch()}
                    >
                        Retry
                    </Button>
                </div>
            );
        }

        return (
            // Keyed so a cached agent switch remounts instead of repainting the previous
            // agent's rows under the new slug for the frame before the reset effect runs.
            <Conversations key={agent._id} agent={agent} selectedConversationId={conversationId || undefined} />
        );
    };

    const renderDetailPanel = () => {
        if (isLoading) {
            return (
                <div className="builder-conversations-detail-loading flex h-full items-center justify-center">
                    <Spinner className="scale-150" />
                </div>
            );
        }

        if (isError || !agent) {
            return renderPlaceholder(
                <BotIcon className="size-10" />,
                'Agent unavailable',
                'This agent could not be loaded. Pick another one from the selector in the header.',
            );
        }

        if (!conversationId) {
            return renderPlaceholder(
                <MessagesSquareIcon className="size-10" />,
                'Select a conversation',
                'Choose a builder conversation from the list on the left to view its messages and details.',
            );
        }

        // Same reason as the list: switching conversations must not paint the outgoing
        // conversation's messages under the incoming id.
        return <ChatDetails key={conversationId} agent={agent} conversationId={conversationId} />;
    };

    const renderSplitView = () => {
        return (
            <ResizablePanelGroup orientation="horizontal">
                <ResizablePanel minSize="15%" defaultSize="20%" maxSize="40%" className="relative">
                    {renderListPanel()}
                </ResizablePanel>
                <ResizableHandle withHandle />
                <ResizablePanel
                    minSize="30%"
                    defaultSize="80%"
                    className="scrollbar-controller scrollbar-vertical scrollbar-horizontal"
                >
                    {renderDetailPanel()}
                </ResizablePanel>
            </ResizablePanelGroup>
        );
    };

    return (
        <div className="builder-conversations-page flex h-full flex-col">
            <Header
                breadcrumbs={[
                    {
                        to: BUILDER_CONVERSATIONS_PATH,
                        title: 'Builder Conversations',
                        // Going back to the chooser is an explicit deselect, so the remembered
                        // agent goes with it — otherwise a reload would restore it.
                        onClick: clearLastSelectedAgent,
                    },
                ]}
                breadcrumbTrailing={
                    agentSlug ? (
                        <AgentPicker
                            selectedSlug={agentSlug}
                            selectedAgent={agent ?? null}
                            fallbackLabel={pendingAgentName}
                            className="h-7 w-auto max-w-[260px] gap-1 border-transparent bg-transparent px-1.5 hover:bg-muted"
                            onChange={onAgentChange}
                        />
                    ) : undefined
                }
            />
            <div
                ref={rootRef}
                className="builder-conversations-body flex h-(--builder-conversations-h,calc(100svh-49px)) min-h-0 flex-col"
            >
                {agentSlug ? renderSplitView() : renderAgentChooser()}
            </div>
        </div>
    );
};

export default BuilderConversations;
