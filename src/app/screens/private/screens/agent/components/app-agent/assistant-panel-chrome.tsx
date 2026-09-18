import { ArrowLeftIcon, ArrowLeftRightIcon, HistoryIcon, PlusIcon } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

import { useAgentLauncherSidesheet } from '@/app/hooks';
import { useRecentsUi } from '@/components/agent-chat/recents/recents-context';
import AvatarMenu from '@/components/avatar-menu';
import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import type { AgentType } from '@/types/admin';

interface Props {
    agent: AgentType;
    /** Panel title, used in the hide/move labels. */
    assistantLabel: string;
    /** Whether the panel is docked on the left. */
    onLeft: boolean;
    /** Icon for the hide button, which mirrors the dock side. */
    hideIcon: LucideIcon;
    onFlipSide: () => void;
    onHide: () => void;
}

const buttonClass = 'rounded-md text-muted-foreground hover:text-foreground';

/**
 * The assistant panel's own toolbar. It sits inside `RecentsUiProvider` because new-chat is
 * owned by the chat below it — the chrome reaches that handler through the lifted context.
 */
const AssistantPanelChrome = ({ agent, assistantLabel, onLeft, hideIcon: HideIcon, onFlipSide, onHide }: Props) => {
    const { open: recentsOpen, setOpen: setRecentsOpen, triggerNewChat } = useRecentsUi();
    const { launcherName, renderInfoIcon, renderAgentDetailsSidesheet } = useAgentLauncherSidesheet(agent);

    const renderNewChat = () => (
        <SimpleTooltip content="New chat" side="bottom">
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={buttonClass}
                aria-label="New chat"
                onClick={triggerNewChat}
            >
                <PlusIcon className="size-4" />
            </Button>
        </SimpleTooltip>
    );

    const renderIdentity = () => (
        <div className="assistant-panel-chrome-identity flex min-w-0 flex-1 items-center gap-1.5">
            <h2 className="brand-name truncate font-bold">{launcherName}</h2>
            <SimpleTooltip content="Info" side="bottom">
                {renderInfoIcon('shrink-0')}
            </SimpleTooltip>
        </div>
    );

    const renderRecentsHeader = () => (
        <div className="assistant-panel-chrome-recents flex min-w-0 flex-1 items-center gap-1.5">
            <SimpleTooltip content="Back to chat" side="bottom">
                <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className={buttonClass}
                    aria-label="Back to chat"
                    onClick={() => setRecentsOpen(false)}
                >
                    <ArrowLeftIcon className="size-4" />
                </Button>
            </SimpleTooltip>
            <h5 className="text-[11px] font-semibold tracking-[0.06em] text-text-secondary uppercase opacity-70">
                Recents
            </h5>
        </div>
    );

    const renderRecents = () => (
        <SimpleTooltip content="Recent chats" side="bottom">
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={buttonClass}
                aria-label="Recent chats"
                aria-pressed={recentsOpen}
                onClick={() => setRecentsOpen(!recentsOpen)}
            >
                <HistoryIcon className="size-4" />
            </Button>
        </SimpleTooltip>
    );

    return (
        // In-flow chrome — never overlay the chat title. The chat home header is
        // `position:absolute; left:16px`, so an `absolute top-2 left-2` row would sit on top of
        // the agent name and its info icon.
        <div className="assistant-panel-chrome flex h-14 shrink-0 items-center gap-0.5 border-b border-border px-1.5">
            {recentsOpen ? renderRecentsHeader() : renderIdentity()}
            {renderAgentDetailsSidesheet()}
            <div className="flex shrink-0 items-center gap-0.5">
                {renderNewChat()}
                {renderRecents()}
                <SimpleTooltip content={`Move panel to the ${onLeft ? 'right' : 'left'}`} side="bottom">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className={buttonClass}
                        aria-label={`Move ${assistantLabel} to the ${onLeft ? 'right' : 'left'}`}
                        onClick={onFlipSide}
                    >
                        <ArrowLeftRightIcon className="size-4" />
                    </Button>
                </SimpleTooltip>
                <SimpleTooltip content={`Hide ${assistantLabel}`} side="bottom">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className={buttonClass}
                        aria-label={`Hide ${assistantLabel}`}
                        onClick={onHide}
                    >
                        <HideIcon className="size-4" />
                    </Button>
                </SimpleTooltip>
                {/* The panel suppresses the chat sidebar that normally carries this, so Admin,
                    Settings and Logout have no other route in on an app-agent screen. This row
                    is outside the chat's MemoryRouter, so its navigation resolves. */}
                <AvatarMenu popupPosition="top-right-edge" />
            </div>
        </div>
    );
};

export default AssistantPanelChrome;
