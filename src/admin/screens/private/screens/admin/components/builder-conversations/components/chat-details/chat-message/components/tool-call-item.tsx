import { ChevronRightIcon, WrenchIcon } from 'lucide-react';
import { useState } from 'react';

import { renderValue } from '@/admin/components/chat-message-shared';
import { CopyButton } from '@/components';

import type { ContentItemTool } from '../../chat-details';

export interface ToolCallAdminItemProps {
    item: ContentItemTool;
}

export const ToolCallAdminItem = ({ item }: ToolCallAdminItemProps) => {
    const [expanded, setExpanded] = useState(false);
    const toolName = item.type.startsWith('tool-') ? item.type.slice(5) : item.type;

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
                <CopyButton text={JSON.stringify({ input: item.input, output: item.output }, null, 2)} size="small" />
            </div>
            {expanded && (
                <div className="tool-call-content py-2 pr-2 pl-[38px] text-xs">
                    <div className="flex flex-col gap-3">
                        <div className="flex items-center gap-2">
                            <span className="text-xs font-medium">ID:</span>
                            <span className="truncate text-xs text-text-secondary">{item.toolCallId}</span>
                        </div>
                        {item.input && Object.keys(item.input).length > 0 && (
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium">Input:</span>
                                {renderValue(item.input)}
                            </div>
                        )}
                        {item.output !== undefined && item.output !== null && (
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium">Output:</span>
                                {renderValue(item.output)}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
