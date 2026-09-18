import { ChevronRightIcon, WrenchIcon } from 'lucide-react';
import { useState } from 'react';

import { renderValue } from '@/admin/components/chat-message-shared';
import { CopyButton } from '@/components';
import type { GenUIDataPayload } from '@/lib/genui/types';

import AdminGenUIApp from '../../admin-genui-app';
import type { ContentItemDataGenui, ContentItemTool } from '../../chat-details';
import { getBridgeStatus } from '../utils/tool-helpers';

export interface GenUIAdminItemProps {
    item: ContentItemDataGenui;
    toolItem?: ContentItemTool;
    state?: Record<string, unknown>;
    agentId: string;
    conversationId: string;
    messageId: string;
}

export const GenUIAdminItem = ({ item, toolItem, state, agentId, conversationId, messageId }: GenUIAdminItemProps) => {
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
                        <span className="truncate text-xs font-medium">{item.data.refName}</span>
                        <span className="shrink-0 text-xs text-text-secondary">GenUI</span>
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
                            <span className="text-xs text-text-secondary">Version</span>
                            <span className="text-xs font-medium break-all">{item.data.version}</span>
                            <span className="text-xs text-text-secondary">State</span>
                            <span className="text-xs font-medium break-all">{toolItem?.state ?? 'data-only'}</span>
                        </div>
                        <AdminGenUIApp
                            payload={item.data as GenUIDataPayload}
                            result={toolItem?.output}
                            status={getBridgeStatus(toolItem)}
                            agentId={agentId}
                            conversationId={conversationId}
                            messageId={messageId}
                            state={state}
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
