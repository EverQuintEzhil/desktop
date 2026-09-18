import { ChevronRight, CircleAlert, RefreshCw } from 'lucide-react';
import { useMemo, useState } from 'react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import type { ConnectorStatus } from '@/hooks';
import type { McpTool, McpToolPreference } from '@/lib/api';
import { cn } from '@/lib/utils';

import ConnectorToolsSkeleton from './components/connector-tools-skeleton';
import { PermissionSwitch } from './components/permission-switch';
import { ToolPermissionRow } from './components/tool-permission-row';
import {
    useConnectorToolsQuery,
    useToolPreferencesQuery,
    useUpdateToolPreferencesMutation,
    type ToolPermission,
} from './hooks/use-connector-queries';

interface ConnectorToolsProps {
    serverId: string;
    status: ConnectorStatus;
    className?: string;
}

type ToolCategory = 'readonly' | 'write' | 'other';

type GroupState = ToolPermission | 'custom';

interface ToolGroupConfig {
    category: ToolCategory;
    label: string;
    description: string;
}

const TOOL_GROUPS: ToolGroupConfig[] = [
    {
        category: 'readonly',
        label: 'Read-only tools',
        description: 'These tools only read data and cannot modify anything.',
    },
    {
        category: 'write',
        label: 'Write & delete tools',
        description: 'These tools can create, update, or delete data.',
    },
    {
        category: 'other',
        label: 'Other tools',
        description: 'Tools without a clear read or write classification.',
    },
];

const defaultPermission = (tool: McpTool): ToolPermission =>
    tool.annotations?.readOnlyHint === true ? 'always_allow' : 'needs_approval';

const getToolCategory = (tool: McpTool): ToolCategory => {
    const readOnly = tool.annotations?.readOnlyHint;

    if (readOnly === true) {
        return 'readonly';
    }

    if (readOnly === false) {
        return 'write';
    }

    return 'other';
};

const isEnabled = (status: ConnectorStatus): boolean => status === 'connected' || status === 'available';

const ConnectorTools = ({ serverId, status, className }: ConnectorToolsProps) => {
    const enabled = isEnabled(status);
    const [openTools, setOpenTools] = useState<Record<string, boolean>>({});

    const { data: tools, isLoading, isError, isFetching, refetch } = useConnectorToolsQuery(serverId, enabled);

    const { data: preferences } = useToolPreferencesQuery(serverId, enabled);

    const isRefreshing = isFetching && !isLoading;

    const prefsByName = useMemo<Record<string, McpToolPreference>>(() => {
        const result: Record<string, McpToolPreference> = {};

        (preferences ?? []).forEach((pref) => {
            result[pref.toolName] = pref;
        });

        return result;
    }, [preferences]);

    const mutation = useUpdateToolPreferencesMutation(serverId);

    const resolvePermission = (tool: McpTool): ToolPermission => {
        const pref = prefsByName[tool.name];

        if (!pref) {
            return defaultPermission(tool);
        }

        if (pref.disabled) {
            return 'blocked';
        }

        if (pref.needsApproval) {
            return 'needs_approval';
        }

        return 'always_allow';
    };

    const handleToolChange = (toolName: string, value: ToolPermission) => {
        mutation.mutate([{ name: toolName, permission: value }]);
    };

    const handleGroupChange = (groupTools: McpTool[], value: ToolPermission) => {
        mutation.mutate(groupTools.map((tool) => ({ name: tool.name, permission: value })));
    };

    const resolveGroupState = (groupTools: McpTool[]): GroupState => {
        const first = resolvePermission(groupTools[0]);
        const allEqual = groupTools.every((tool) => resolvePermission(tool) === first);

        return allEqual ? first : 'custom';
    };

    const renderGroupDefault = (groupTools: McpTool[], groupState: GroupState) => (
        <div className="group/default ml-auto flex shrink-0 items-center gap-2.5">
            <span className="text-sm text-muted-foreground">Default</span>
            {groupState === 'custom' ? <span className="text-xs text-muted-foreground">Custom</span> : null}
            <PermissionSwitch
                value={groupState === 'custom' ? null : groupState}
                onChange={(next) => handleGroupChange(groupTools, next)}
            />
        </div>
    );

    const renderToolRow = (tool: McpTool) => {
        const permission = resolvePermission(tool);

        return (
            <ToolPermissionRow
                key={tool.name}
                tool={tool}
                permission={permission}
                isOpen={!!openTools[tool.name]}
                onToggle={() => setOpenTools((current) => ({ ...current, [tool.name]: !current[tool.name] }))}
                onChange={(next) => handleToolChange(tool.name, next)}
            />
        );
    };

    const renderGroup = (config: ToolGroupConfig, label: string, groupTools: McpTool[]) => {
        const groupState = resolveGroupState(groupTools);

        return (
            <Collapsible key={config.category} defaultOpen className="flex flex-col">
                <div className="flex flex-wrap items-center gap-4 px-4 py-4">
                    <CollapsibleTrigger
                        className={cn(
                            'group/trigger flex min-w-0 flex-1 cursor-pointer items-start gap-2 rounded-md text-left outline-none sm:min-w-55',
                            'focus-visible:ring-2 focus-visible:ring-(--color-focus-ring)',
                        )}
                    >
                        <ChevronRight
                            className={cn(
                                'mt-0.5 size-4 shrink-0 text-muted-foreground transition-[transform,color]',
                                'group-hover/trigger:text-foreground group-data-[state=open]/trigger:rotate-90',
                            )}
                            aria-hidden="true"
                        />
                        <div className="flex min-w-0 flex-col gap-0.5">
                            <span className="flex items-center gap-2">
                                <span className="truncate text-h5 font-semibold">{label}</span>
                                <Badge
                                    variant="secondary"
                                    className="h-5 min-w-5 shrink-0 justify-center rounded-full border-transparent bg-muted px-1.5 text-[11px] text-muted-foreground"
                                >
                                    {groupTools.length}
                                </Badge>
                            </span>
                            <span className="truncate text-sm text-muted-foreground">{config.description}</span>
                        </div>
                    </CollapsibleTrigger>
                    {renderGroupDefault(groupTools, groupState)}
                </div>
                <CollapsibleContent>
                    <>
                        <div
                            className={cn(
                                'grid grid-cols-[minmax(0,1fr)_auto] gap-x-5 bg-muted py-2.5 pr-4 pl-9.5',
                                'text-[11px] font-semibold tracking-wider text-muted-foreground uppercase',
                            )}
                        >
                            <span>Tool</span>
                            <span className="text-right">Access</span>
                        </div>
                        <div className="divide-y divide-border">{groupTools.map((tool) => renderToolRow(tool))}</div>
                    </>
                </CollapsibleContent>
            </Collapsible>
        );
    };

    const renderBody = () => {
        if (!enabled) {
            return (
                <Card className="gap-0 border-transparent p-4 shadow-none">
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">Tools are unavailable</span>
                        <span className="block pt-1 text-xs text-muted-foreground">
                            Connect this connector to view and configure its tools.
                        </span>
                    </div>
                </Card>
            );
        }

        if (isLoading) {
            return <ConnectorToolsSkeleton />;
        }

        if (isError) {
            return (
                <Card className="gap-0 border-transparent bg-card p-4 shadow-none">
                    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                        <div className="flex min-w-0 items-start gap-3">
                            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-destructive/10 text-destructive">
                                <CircleAlert className="size-5" aria-hidden="true" />
                            </span>
                            <div className="flex min-w-0 flex-col gap-1">
                                <span className="text-sm font-medium">Couldn&apos;t load tools</span>
                                <span className="text-xs leading-relaxed text-muted-foreground">
                                    We couldn&apos;t fetch this connector&apos;s tools. Try again without leaving this
                                    page.
                                </span>
                            </div>
                        </div>
                        <Button variant="destructive" size="sm" disabled={isFetching} onClick={() => void refetch()}>
                            <RefreshCw className={cn('size-3.5', isFetching && 'animate-spin')} aria-hidden="true" />
                            Try again
                        </Button>
                    </div>
                </Card>
            );
        }

        if (!tools || tools.length === 0) {
            return (
                <Card className="gap-0 border-transparent p-4 shadow-none">
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-medium">No tools available</span>
                        <span className="text-xs text-muted-foreground">
                            This connector does not currently expose any tools.
                        </span>
                    </div>
                </Card>
            );
        }

        const groups = TOOL_GROUPS.map((config) => ({
            config,
            items: tools.filter((tool) => getToolCategory(tool) === config.category),
        })).filter((group) => group.items.length > 0);

        const onlyOther = groups.length === 1 && groups[0].config.category === 'other';

        return (
            <Card className="gap-0 overflow-hidden p-0 shadow-none">
                <div className="border-b border-border px-4 py-4">
                    <div className="flex flex-col gap-1">
                        <span className="text-sm font-semibold">Tool permissions</span>
                        <span className="text-xs text-muted-foreground">
                            Choose when agents are allowed to use these tools.
                        </span>
                    </div>
                </div>
                <div className="relative">
                    <div
                        className={cn(
                            'divide-y divide-border transition-opacity',
                            isRefreshing && 'pointer-events-none opacity-40 select-none',
                        )}
                        aria-busy={isRefreshing}
                    >
                        {groups.map((group) =>
                            renderGroup(group.config, onlyOther ? 'Tools' : group.config.label, group.items),
                        )}
                    </div>
                    {isRefreshing ? (
                        <div
                            className="pointer-events-none absolute inset-0 flex items-center justify-center"
                            role="status"
                            aria-live="polite"
                        >
                            <span className="flex items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-muted-foreground shadow-sm">
                                <RefreshCw className="size-3.5 animate-spin" aria-hidden="true" />
                                Refreshing…
                            </span>
                        </div>
                    ) : null}
                </div>
            </Card>
        );
    };

    return <div className={cn('connector-tools mt-4 flex flex-col gap-4', className)}>{renderBody()}</div>;
};

export default ConnectorTools;
