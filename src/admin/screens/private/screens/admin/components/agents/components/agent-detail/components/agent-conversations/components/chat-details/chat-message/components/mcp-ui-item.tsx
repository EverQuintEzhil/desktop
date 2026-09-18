import { ChevronRightIcon, WrenchIcon } from 'lucide-react';
import { useState } from 'react';

import { renderValue } from '@/admin/components/chat-message-shared';
import { CopyButton } from '@/components';
import { formatToolName } from '@/components/assistant-ui/tool-label';

import AdminMcpUiResource, { type AdminMcpUiPayload } from '../../admin-mcp-ui-resource';
import type { ContentItemDataMcpui } from '../../chat-details';

export interface McpUiAdminItemProps {
    item: ContentItemDataMcpui;
    appName?: string;
    faviconUrl?: string;
}

export const McpUiAdminItem = ({ item, appName, faviconUrl }: McpUiAdminItemProps) => {
    const [expanded, setExpanded] = useState(false);

    return (
        <div className="tool-call-accordion">
            <div
                className="tool-call-header flex w-full cursor-pointer items-center justify-between gap-2 rounded-md p-2 select-none"
                onClick={() => setExpanded((prev) => !prev)}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        setExpanded((prev) => !prev);
                    }
                }}
            >
                <div className="flex min-w-0 items-center gap-3">
                    <ChevronRightIcon
                        className={`tool-call-chevron ${expanded ? 'is-expanded' : ''} size-4 shrink-0`}
                    />
                    <div className="flex min-w-0 items-center gap-2">
                        <WrenchIcon className="size-3 shrink-0 text-text-secondary" />
                        <span className="truncate text-xs font-medium">{formatToolName(item.data.toolName)}</span>
                        <span className="shrink-0 text-xs text-text-secondary">MCP UI</span>
                    </div>
                </div>
                <CopyButton text={JSON.stringify(item, null, 2)} size="small" />
            </div>
            {expanded && (
                <div className="tool-call-content py-2 pr-2 pl-[38px] text-xs">
                    <div className="flex flex-col gap-3">
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                            <span className="text-xs text-text-secondary">Tool call ID</span>
                            <span className="text-xs font-medium break-all">{item.data.toolCallId}</span>
                            <span className="text-xs text-text-secondary">Server ID</span>
                            <span className="text-xs font-medium break-all">{item.data.serverId}</span>
                            <span className="text-xs text-text-secondary">Resource URI</span>
                            <span className="text-xs font-medium break-all">{item.data.resourceUri ?? 'none'}</span>
                        </div>
                        <AdminMcpUiResource
                            payload={item.data as AdminMcpUiPayload}
                            appName={appName}
                            toolLabel={formatToolName(item.data.toolName)}
                            faviconUrl={faviconUrl}
                        />
                        <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium">Data Part</span>
                            {renderValue(item)}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
