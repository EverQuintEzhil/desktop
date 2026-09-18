import {
    CalendarClockIcon,
    FolderIcon,
    HatGlassesIcon,
    LibraryBigIcon,
    SearchIcon,
    SquarePenIcon,
    SquareTerminalIcon,
} from 'lucide-react';
import type { KeyboardEvent, MouseEvent } from 'react';
import { Link } from 'react-router-dom';

import { useCanSeeRoutines } from '@/app/screens/private/screens/routines/routines-visibility';
import type { AgentComposerState } from '@/components/agent-chat/types';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';

import { SIDEBAR_ROUTINES_LIST_ID, UNPINNED_SPACES_LIST_ID } from '../constants';
import type { UnpinnedSpacesListProps } from '../unpinned-spaces-list';
import UnpinnedSpacesList from '../unpinned-spaces-list';

import SidebarNavExpandToggle from './sidebar-nav-expand-toggle';
import SidebarRoutinesList from './sidebar-routines-list';

interface ExpandableSection {
    isExpanded: boolean;
    onToggleClick: (e: MouseEvent<HTMLDivElement>) => void;
    onToggleKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
}

interface SpacesSection extends ExpandableSection {
    list: Omit<UnpinnedSpacesListProps, 'id' | 'agent'>;
}

interface Props {
    agent: ChatAgentType;
    activePath: string;
    showHomeState: boolean;
    isLibraryActive: boolean;
    isCollapsed: boolean;
    spaces: SpacesSection;
    routines: ExpandableSection;
    composer: AgentComposerState;
    onMobileClose?: () => void;
    onIncognitoKeyDown: (e: KeyboardEvent<HTMLDivElement>) => void;
}

const SidebarNavList = (props: Props) => {
    const {
        agent,
        activePath,
        showHomeState,
        isLibraryActive,
        isCollapsed,
        spaces,
        routines,
        composer,
        onMobileClose,
        onIncognitoKeyDown,
    } = props;

    const canSeeRoutines = useCanSeeRoutines(agent.uiConfig);
    // An expanded list renders inside its nav row, so a pinned nav would grow to cover the history scrolling under it.
    const isAnyListExpanded =
        !isCollapsed &&
        ((Boolean(agent.uiConfig.spaces?.enabled) && spaces.isExpanded) || (canSeeRoutines && routines.isExpanded));

    const isHomeActive =
        agent.uiConfig.home?.startPage === 'library'
            ? activePath === 'chat' || (activePath === '' && showHomeState)
            : activePath === '';

    const renderLibraryLink = () => (
        <li>
            <SimpleTooltip content="Library" side="right" disabled={!isCollapsed}>
                <Link
                    to={`/agent/${agent.slug}/library`}
                    className={`home-nav flex items-center gap-2 rounded-lg p-2 ${isLibraryActive ? 'active' : ''}`}
                    onClick={onMobileClose}
                >
                    <LibraryBigIcon className="size-4" />
                    <span className="text-sm font-medium">Library</span>
                </Link>
            </SimpleTooltip>
        </li>
    );

    return (
        <ul
            className={cn(
                'aside-accordion-list main-nav flex flex-col gap-0.5 px-2 pt-2',
                !isAnyListExpanded && 'sticky-nav',
            )}
        >
            {agent.uiConfig.library && agent.uiConfig.home?.startPage === 'library' && renderLibraryLink()}
            <li>
                <Link
                    to={`/agent/${agent.slug}`}
                    state={agent.uiConfig.home?.startPage === 'library' ? { showHome: true } : undefined}
                    className={`home-nav relative flex items-center gap-2 rounded-lg p-2 ${isHomeActive ? 'active' : ''}`}
                    onClick={onMobileClose}
                >
                    <SimpleTooltip content="New Chat" side="right" disabled={!isCollapsed}>
                        <SquarePenIcon className="size-4" />
                    </SimpleTooltip>
                    <span className="text-sm font-medium">New Chat</span>
                    {!isCollapsed && agent.uiConfig?.home?.search?.isIncognitoEnabled && (
                        <SimpleTooltip
                            content={
                                composer.isIncognitoMode
                                    ? 'Turn off Temporary chat — messages are not saved and the agent will not remember this conversation'
                                    : 'Turn on Temporary chat — messages will not be saved and the agent will not remember this conversation'
                            }
                            side="right"
                            className="max-w-[240px]"
                        >
                            <div
                                className={cn(
                                    'incognito-button ml-auto flex items-center justify-center',
                                    composer.isIncognitoMode && 'is-incognito-on',
                                )}
                                onClick={() => composer.toggleIncognitoMode()}
                                role="button"
                                tabIndex={0}
                                aria-label={
                                    composer.isIncognitoMode ? 'Turn off temporary chat' : 'Turn on temporary chat'
                                }
                                aria-pressed={composer.isIncognitoMode}
                                onKeyDown={onIncognitoKeyDown}
                            >
                                <HatGlassesIcon className="size-4" />
                            </div>
                        </SimpleTooltip>
                    )}
                </Link>
            </li>
            <li>
                <Link
                    to={`/agent/${agent.slug}/search-chat`}
                    className={`home-nav flex items-center gap-2 rounded-lg p-2 ${activePath === 'search-chat' ? 'active' : ''}`}
                    onClick={onMobileClose}
                >
                    <SimpleTooltip content="Search Chat" side="right" disabled={!isCollapsed}>
                        <SearchIcon className="size-4" />
                    </SimpleTooltip>
                    <span className="text-sm font-medium">Search Chats</span>
                </Link>
            </li>
            {agent.uiConfig.library && agent.uiConfig.home?.startPage !== 'library' && renderLibraryLink()}
            {agent.uiConfig.promptLibrary?.enabled && (
                <li>
                    <Link
                        to={`/agent/${agent.slug}/prompt-library`}
                        className={`home-nav flex items-center gap-2 rounded-lg p-2 ${activePath?.includes('prompt-library') ? 'active' : ''}`}
                        onClick={onMobileClose}
                    >
                        <SimpleTooltip content="Prompt Library" side="right" disabled={!isCollapsed}>
                            <SquareTerminalIcon className="size-4" />
                        </SimpleTooltip>
                        <span className="text-sm font-medium">Prompt Library</span>
                    </Link>
                </li>
            )}
            {agent.uiConfig.spaces?.enabled && (
                <li>
                    <Link
                        to={`/agent/${agent.slug}/spaces`}
                        className={`group home-nav flex items-center gap-2 rounded-lg p-2 ${activePath === 'spaces' ? 'active' : ''}`}
                        onClick={onMobileClose}
                    >
                        <SimpleTooltip content="Spaces" side="right" disabled={!isCollapsed}>
                            <FolderIcon className="size-4" />
                        </SimpleTooltip>
                        <span className="text-sm font-medium">Spaces</span>
                        {!isCollapsed && (
                            <SidebarNavExpandToggle
                                listId={UNPINNED_SPACES_LIST_ID}
                                isExpanded={spaces.isExpanded}
                                expandLabel="Show spaces"
                                collapseLabel="Hide spaces"
                                onClick={spaces.onToggleClick}
                                onKeyDown={spaces.onToggleKeyDown}
                            />
                        )}
                    </Link>
                    {spaces.isExpanded && (
                        <UnpinnedSpacesList id={UNPINNED_SPACES_LIST_ID} agent={agent} {...spaces.list} />
                    )}
                </li>
            )}
            {canSeeRoutines && (
                <li>
                    <Link
                        to={`/agent/${agent.slug}/routines`}
                        className={`group home-nav flex items-center gap-2 rounded-lg p-2 ${activePath === 'routines' ? 'active' : ''}`}
                        onClick={onMobileClose}
                    >
                        <SimpleTooltip content="Routines" side="right" disabled={!isCollapsed}>
                            <CalendarClockIcon className="size-4" />
                        </SimpleTooltip>
                        <span className="text-sm font-medium">Routines</span>
                        {!isCollapsed && (
                            <SidebarNavExpandToggle
                                listId={SIDEBAR_ROUTINES_LIST_ID}
                                isExpanded={routines.isExpanded}
                                expandLabel="Show routines"
                                collapseLabel="Hide routines"
                                onClick={routines.onToggleClick}
                                onKeyDown={routines.onToggleKeyDown}
                            />
                        )}
                    </Link>
                    {routines.isExpanded && (
                        <SidebarRoutinesList
                            id={SIDEBAR_ROUTINES_LIST_ID}
                            agentId={agent._id}
                            agentSlug={agent.slug}
                            isCollapsed={isCollapsed}
                            activePath={activePath}
                            onMobileClose={onMobileClose}
                        />
                    )}
                </li>
            )}
        </ul>
    );
};

export type { Props as SidebarNavListProps };
export default SidebarNavList;
