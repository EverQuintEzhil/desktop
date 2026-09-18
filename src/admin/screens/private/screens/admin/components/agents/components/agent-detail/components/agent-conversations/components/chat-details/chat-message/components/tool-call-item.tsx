import { ChevronRightIcon, WrenchIcon } from 'lucide-react';
import { useState } from 'react';

import { renderValue } from '@/admin/components/chat-message-shared';
import { CopyButton } from '@/components';

import type { ContentItemTool } from '../../chat-details';
import { getToolName } from '../utils/tool-helpers';

export interface ToolCallAdminItemProps {
    item: ContentItemTool;
}

export const ToolCallAdminItem = ({ item }: ToolCallAdminItemProps) => {
    const [expanded, setExpanded] = useState(false);
    const toolName = getToolName(item);

    const renderDetail = (label: string, value: unknown) => {
        if (value === null || value === undefined) return null;
        if (typeof value === 'object' && Object.keys(value).length === 0) return null;

        return (
            <div className="flex flex-col gap-1">
                <span className="text-xs font-medium">{label}</span>
                {renderValue(value)}
            </div>
        );
    };

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
                <div className="flex items-center gap-3">
                    <ChevronRightIcon className={`tool-call-chevron ${expanded ? 'is-expanded' : ''} size-4`} />
                    <div className="flex items-center gap-2">
                        <WrenchIcon className="size-3 shrink-0 text-text-secondary" />
                        <span className="text-xs font-medium">{toolName}</span>
                    </div>
                </div>
                <CopyButton text={JSON.stringify(item, null, 2)} size="small" />
            </div>
            {expanded && (
                <div className="tool-call-content py-2 pr-2 pl-[38px] text-xs">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">ID:</span>
                            <span className="truncate text-xs text-text-secondary">{item.toolCallId}</span>
                        </div>
                        <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                            <span className="text-xs text-text-secondary">Type</span>
                            <span className="text-xs font-medium break-all">{item.type}</span>
                            <span className="text-xs text-text-secondary">State</span>
                            <span className="text-xs font-medium break-all">{item.state}</span>
                            <span className="text-xs text-text-secondary">Provider executed</span>
                            <span className="text-xs font-medium">{String(item.providerExecuted ?? false)}</span>
                        </div>
                        {renderDetail('Input', item.input)}
                        {renderDetail('Output', item.output)}
                        {renderDetail('Error', item.errorText)}
                        {renderDetail('Approval', item.approval)}
                        {renderDetail('Call Provider Metadata', item.callProviderMetadata)}
                        {renderDetail('Result Provider Metadata', item.resultProviderMetadata)}
                        {renderDetail('Raw Part', item)}
                    </div>
                </div>
            )}
        </div>
    );
};
