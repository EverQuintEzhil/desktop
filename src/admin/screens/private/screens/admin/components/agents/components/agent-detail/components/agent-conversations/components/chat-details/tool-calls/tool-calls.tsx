import { ChevronRightIcon } from 'lucide-react';
import { useState } from 'react';
import { JsonView, collapseAllNested } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

import { CopyButton } from '@/components';

import '../../conversation-details/conversation-details.scss';

import './tool-calls.scss';

export interface ToolCall {
    id: string;
    type: string;
    function: {
        name: string;
        arguments: string;
    };
}

interface ToolCallItemProps {
    toolCall: ToolCall;
    openToolCallMessage: (toolCallId: string) => void;
}

const ToolCallItem = (props: ToolCallItemProps) => {
    const { toolCall, openToolCallMessage } = props;
    const [isExpanded, setIsExpanded] = useState(false);

    const toggleToolCall = () => {
        setIsExpanded((prev) => !prev);
    };

    const parseJsonSafely = (jsonString: string) => {
        try {
            return JSON.parse(jsonString);
        } catch {
            return jsonString;
        }
    };

    const functionName = toolCall.function?.name || toolCall.type || 'Unknown';
    const parsedArguments = toolCall.function?.arguments ? parseJsonSafely(toolCall.function.arguments) : null;

    return (
        <div className="tool-call-accordion">
            <div
                className="tool-call-header flex w-full cursor-pointer items-center justify-between gap-2 rounded-md p-2 select-none"
                onClick={toggleToolCall}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleToolCall();
                    }
                }}
            >
                <div className="flex items-center gap-3">
                    <ChevronRightIcon className={`tool-call-chevron ${isExpanded ? 'is-expanded' : ''} size-4`} />
                    <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{functionName}</span>
                        {toolCall.type && <span className="text-sm">({toolCall.type})</span>}
                    </div>
                </div>
                <CopyButton text={JSON.stringify(toolCall, null, 2)} size="small" />
            </div>
            {isExpanded && (
                <div className="tool-call-content py-2 pr-2 pl-[38px] text-xs">
                    <div className="flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                            <span className="text-sm">ID:</span>
                            <span
                                className="cursor-pointer text-sm hover:underline"
                                onClick={() => {
                                    openToolCallMessage(toolCall.id);
                                    setTimeout(() => {
                                        const messageElement = document.getElementById(`message-${toolCall.id}`);
                                        const scrollElement = document.getElementsByClassName('pane-1')?.[1];

                                        if (messageElement && scrollElement) {
                                            scrollElement.scrollTo({
                                                top: messageElement.offsetTop,
                                                behavior: 'smooth',
                                            });
                                        }
                                    }, 500);
                                }}
                            >
                                {toolCall.id}
                            </span>
                        </div>

                        <div className="flex items-center gap-2">
                            <span className="text-sm">Type:</span>
                            <span className="text-sm">{toolCall.type}</span>
                        </div>

                        {toolCall.function?.name && (
                            <div className="flex items-center gap-2">
                                <span className="text-sm">Function:</span>
                                <span className="text-sm">{toolCall.function.name}</span>
                            </div>
                        )}

                        {toolCall.function?.arguments && (
                            <div className="flex flex-col gap-1">
                                <span className="text-xs font-medium">Arguments:</span>
                                {parsedArguments && typeof parsedArguments === 'object' ? (
                                    <div className="json-view-wrapper rounded-sm p-[6px]">
                                        <JsonView
                                            data={parsedArguments}
                                            shouldExpandNode={collapseAllNested}
                                            clickToExpandNode
                                        />
                                    </div>
                                ) : (
                                    <span className="text-sm">{toolCall.function.arguments}</span>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};

interface ToolCallsProps {
    toolCalls: ToolCall[];
    openToolCallMessage: (toolCallId: string) => void;
}

const ToolCalls = (props: ToolCallsProps) => {
    const { toolCalls, openToolCallMessage } = props;

    if (!toolCalls || toolCalls.length === 0) {
        return null;
    }

    return (
        <div className="flex flex-col gap-2">
            {toolCalls.map((toolCall) => (
                <ToolCallItem key={toolCall.id} toolCall={toolCall} openToolCallMessage={openToolCallMessage} />
            ))}
        </div>
    );
};

export default ToolCalls;
