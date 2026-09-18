import { FileCode2Icon, Globe, RotateCw, UserRoundIcon, X } from 'lucide-react';
import { useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';

import ConnectorAvatar from '@/app/screens/private/screens/connectors/components/connector-avatar';
import { useAgentComposerContext } from '@/components/agent-chat/context/agent-composer-context';
import type { NonOauthConnector } from '@/components/agent-chat/types';
import { DescriptionHoverCard } from '@/components/description-hover-card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';
import { ToggleSwitch } from '@/components/ui/toggle-switch';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { isTokenExpired } from '@/hooks';
import type { McpConnection } from '@/lib/api';
import { cn } from '@/lib/utils';
import type { ChatAgentType, SkillType } from '@/types/admin';

import { CARD_LIST_CLASS_NAME, CARD_ROW_CLASS_NAME, CARD_STATE_ROW_CLASS_NAME } from './constants';

interface ChatToolsPanelProps {
    agent: ChatAgentType;
    className?: string;
}

const ChatToolsPanel = ({ agent, className }: ChatToolsPanelProps) => {
    const location = useLocation();
    // Same composer instance as the "+" Connectors/Skills menus — separate hook
    // calls here used to keep independent optimistic overrides and desync the toggles.
    const { composer } = useAgentComposerContext();
    const { connectors, customConnectorIds, sharedConnectorIds, skills: skillsState } = composer;
    const {
        connections,
        nonOauthConnectors,
        isLoading,
        disabledMap,
        toggleMcpServer,
        reconnect,
        connectingId,
        cancelConnection,
        cancellingId,
    } = connectors;
    const customConnectorIdSet = useMemo(() => new Set(customConnectorIds), [customConnectorIds]);
    const sharedConnectorIdSet = useMemo(() => new Set(sharedConnectorIds), [sharedConnectorIds]);

    const {
        skills,
        customIds: customSkillIds,
        sharedIds: sharedSkillIds,
        enabledIds: enabledSkillIds,
        toggleSkill,
    } = skillsState;
    const customSkillIdSet = useMemo(() => new Set(customSkillIds), [customSkillIds]);
    const sharedSkillIdSet = useMemo(() => new Set(sharedSkillIds), [sharedSkillIds]);
    const connectorCount = connections.length + nonOauthConnectors.length;

    const serverUrlById = new Map((agent.mcpServers ?? []).map((server) => [server._id, server.serverUrl]));

    const from = `${location.pathname}${location.search}`;

    const renderCustomBadge = (isCustom: boolean, label: string, Icon: typeof UserRoundIcon = UserRoundIcon) => {
        if (!isCustom) {
            return null;
        }

        return (
            <TooltipProvider>
                <Tooltip disableHoverableContent>
                    <TooltipTrigger asChild>
                        <span className="flex items-center">
                            <Icon className="size-4 shrink-0 text-primary" aria-label={label} />
                        </span>
                    </TooltipTrigger>
                    <TooltipContent className="pointer-events-none! z-52">{label}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    const renderSectionHeader = (label: string, count: number, manageTo: string) => (
        <div className="flex h-6 items-center justify-between gap-2 px-1">
            <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                {label}
                <Badge
                    variant="secondary"
                    className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px] font-medium text-muted-foreground"
                >
                    {count}
                </Badge>
            </span>
            <Link
                to={manageTo}
                state={{ from }}
                className="text-xs font-medium text-primary no-underline hover:underline"
            >
                Manage
            </Link>
        </div>
    );

    const renderConnectorRow = (id: string, name: string, control: React.ReactNode) => (
        <li key={id} className={CARD_ROW_CLASS_NAME}>
            <ConnectorAvatar
                name={name}
                serverUrl={serverUrlById.get(id)}
                className="size-10 rounded-xl bg-primary/10 text-xs font-semibold text-primary"
            />
            <span className="min-w-0 flex-1 truncate text-sm font-medium">{name}</span>
            {renderCustomBadge(customConnectorIdSet.has(id), 'Your custom connector')}
            {renderCustomBadge(sharedConnectorIdSet.has(id), 'Enterprise', Globe)}
            {control}
        </li>
    );

    const renderReconnectButton = (mcpServerId: string) => {
        const isReconnecting = connectingId === mcpServerId;
        const label = isReconnecting ? 'Reconnecting…' : 'Reconnect';

        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="icon-xs"
                            variant="secondary"
                            disabled={isReconnecting}
                            aria-label={label}
                            className="shrink-0"
                            onClick={() => reconnect(mcpServerId)}
                        >
                            {isReconnecting ? <Spinner className="size-3.5" /> : <RotateCw className="size-3.5" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="z-52">{label}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    const renderCancelButton = (mcpServerId: string) => {
        const isCancelling = cancellingId === mcpServerId;
        const label = isCancelling ? 'Cancelling…' : 'Cancel connection';

        return (
            <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                        <Button
                            size="icon-xs"
                            variant="ghost"
                            disabled={isCancelling}
                            aria-label={label}
                            className="shrink-0"
                            onClick={() => cancelConnection(mcpServerId)}
                        >
                            {isCancelling ? <Spinner className="size-3.5" /> : <X className="size-3.5" />}
                        </Button>
                    </TooltipTrigger>
                    <TooltipContent className="z-52">{label}</TooltipContent>
                </Tooltip>
            </TooltipProvider>
        );
    };

    const renderConnectionRow = (connection: McpConnection) => {
        const id = connection.mcpServerId;
        const name = connection.mcpServerName ?? 'Unknown server';

        if (connection.status === 'pending') {
            return renderConnectorRow(id, name, renderCancelButton(id));
        }

        const needsReconnect = connection.status !== 'connected' || isTokenExpired(connection.tokenExpiry);
        const showReconnect = needsReconnect && !disabledMap[id];

        return renderConnectorRow(
            id,
            name,
            <span className="flex shrink-0 items-center gap-2">
                {showReconnect ? renderReconnectButton(id) : null}
                <ToggleSwitch
                    checked={!disabledMap[id]}
                    onCheckedChange={() => toggleMcpServer(id)}
                    aria-label={`Toggle ${name}`}
                />
            </span>,
        );
    };

    const renderNonOauthRow = (connector: NonOauthConnector) =>
        renderConnectorRow(
            connector._id,
            connector.name,
            <ToggleSwitch
                checked={!disabledMap[connector._id]}
                onCheckedChange={() => toggleMcpServer(connector._id)}
                aria-label={`Toggle ${connector.name}`}
            />,
        );

    const renderConnectorsList = () => {
        if (isLoading) {
            return (
                <div className={CARD_STATE_ROW_CLASS_NAME}>
                    <Spinner className="size-4" />
                </div>
            );
        }

        if (connectorCount === 0) {
            return <div className={CARD_STATE_ROW_CLASS_NAME}>No connectors found</div>;
        }

        return (
            <ul className="chat-tools-panel-connectors-list scrollbar-controller scrollbar-vertical flex flex-col lg:max-h-[192px]">
                {connections.map(renderConnectionRow)}
                {nonOauthConnectors.map(renderNonOauthRow)}
            </ul>
        );
    };

    const renderSkillRow = (skill: SkillType) => (
        <li key={skill._id} className={CARD_ROW_CLASS_NAME}>
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <FileCode2Icon className="size-5" />
            </span>
            <div className="chat-tools-panel-skills-row-content flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-medium">{skill.name}</span>
                {skill.description ? (
                    <DescriptionHoverCard name={skill.name} description={skill.description} side="left">
                        <span className="truncate text-xs text-muted-foreground">{skill.description}</span>
                    </DescriptionHoverCard>
                ) : null}
            </div>
            {renderCustomBadge(customSkillIdSet.has(skill._id), 'Your custom skill')}
            {renderCustomBadge(sharedSkillIdSet.has(skill._id), 'Enterprise', Globe)}
            <ToggleSwitch
                checked={enabledSkillIds.includes(skill._id)}
                onCheckedChange={() => toggleSkill(skill._id)}
                aria-label={`Toggle ${skill.name}`}
            />
        </li>
    );

    const renderSkillsList = () => {
        if (skills.length === 0) {
            return <div className={CARD_STATE_ROW_CLASS_NAME}>No skills found</div>;
        }

        return (
            <ul className="chat-tools-panel-skills-list scrollbar-controller scrollbar-vertical flex flex-col lg:max-h-[192px]">
                {skills.map(renderSkillRow)}
            </ul>
        );
    };

    return (
        <div className={cn('chat-tools-panel flex flex-col gap-5', className)}>
            <div className="chat-tools-panel-connectors flex flex-col gap-2">
                {renderSectionHeader('Connectors', connectorCount, '/settings/connectors')}
                <div className={CARD_LIST_CLASS_NAME}>{renderConnectorsList()}</div>
            </div>
            <div className="chat-tools-panel-skills flex flex-col gap-2">
                {renderSectionHeader('Skills', skills.length, '/settings/skills')}
                <div className={CARD_LIST_CLASS_NAME}>{renderSkillsList()}</div>
            </div>
        </div>
    );
};

export default ChatToolsPanel;
