import { ChevronRightIcon } from 'lucide-react';
import { useCallback, useState } from 'react';

import {
    DataStoreFileItem,
    MessageFileItem,
    MessageFilesSection,
    SourceLink,
    formatTokenValue,
} from '@/admin/components/chat-message-shared';
import { CopyButton, ExpandableText, Markdown } from '@/components';
import { formatDateTime } from '@/utils/date';

import type {
    AdminConversationMessage,
    ContentItemDataSources,
    ContentItemText,
    ContentItemTool,
} from '../chat-details';

import { AiInfoSection } from './components/ai-info-section';
import { ToolCallAdminItem } from './components/tool-call-item';
import '../../conversation-details/conversation-details.scss';

import './chat-message.scss';
import '@/styles/file-preview.scss';

interface ChatMessageAdminProps {
    message: AdminConversationMessage;
    isExpanded: boolean;
    toggleMessage: () => void;
}

export const ChatMessageAdmin = (props: ChatMessageAdminProps) => {
    // Held here, not in AiInfoSection: that child unmounts when the row collapses.
    const [aiInfoExpanded, setAiInfoExpanded] = useState(false);
    const toggleAiInfo = useCallback(() => setAiInfoExpanded((prev) => !prev), []);

    const { message, isExpanded, toggleMessage } = props;

    const { role, created_at, ai_info, content, reasoning, metadata } = message;
    const headerTotalTokens = formatTokenValue(ai_info?.token_usage?.total_tokens);

    const renderMessageHeader = () => {
        const firstText = content.find((i): i is ContentItemText => i.type === 'text');

        return (
            <div
                className="chat-message-header flex w-full cursor-pointer items-center justify-between gap-2 rounded-md px-2 py-2 select-none"
                onClick={toggleMessage}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        toggleMessage();
                    }
                }}
            >
                <div className="flex min-w-0 items-center gap-2">
                    <ChevronRightIcon
                        className={`chat-message-chevron shrink-0 ${isExpanded ? 'is-expanded' : ''} size-4`}
                    />
                    <span className="shrink-0 text-xs capitalize">{role}</span>
                    {ai_info && <span className="shrink-0 text-xs text-text-secondary">{ai_info.model}</span>}
                    {!isExpanded && firstText && (
                        <span className="truncate text-xs text-text-secondary">{firstText.text}</span>
                    )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                    {headerTotalTokens && (
                        <span className="text-xs text-text-secondary">{headerTotalTokens} tokens</span>
                    )}
                    <span className="text-xs">{formatDateTime(created_at)}</span>
                </div>
            </div>
        );
    };

    const renderMessageContent = () => {
        const textItems = content.filter((item): item is ContentItemText => item.type === 'text');
        const toolItems = content.filter((item): item is ContentItemTool => item.type.startsWith('tool-'));
        const dataSourcesItems = content.filter((item): item is ContentItemDataSources => item.type === 'data-sources');

        const hasSourcesInContent = dataSourcesItems.length > 0;
        const metadataSources =
            !hasSourcesInContent && message.metadata?.sources?.length ? message.metadata.sources : null;
        const metadataFiles = metadata?.files?.length ? metadata.files : null;
        const metadataDataStoreFiles = metadata?.dataStoreFiles?.length ? metadata.dataStoreFiles : null;

        return (
            <div className="chat-message-content flex flex-col gap-4 pl-6">
                {textItems.length > 0 && (
                    <div className="each-row flex flex-col px-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Content</span>
                            <CopyButton text={textItems.map((t) => t.text).join('\n\n')} size="small" />
                        </div>
                        <div>
                            {textItems.map((item, idx) => (
                                <div key={`text-${idx}`} className="markdown-scroll-wrapper block">
                                    <Markdown>{item.text}</Markdown>
                                </div>
                            ))}
                        </div>
                    </div>
                )}

                {metadataFiles && (
                    <MessageFilesSection title={`Files (${metadataFiles.length})`}>
                        {metadataFiles.map((file) => (
                            <MessageFileItem key={file._id} file={file} />
                        ))}
                    </MessageFilesSection>
                )}

                {metadataDataStoreFiles && (
                    <MessageFilesSection title={`Data store Files (${metadataDataStoreFiles.length})`}>
                        {metadataDataStoreFiles.map((file) => (
                            <DataStoreFileItem key={`${file.storeId}-${file.fileId}`} file={file} />
                        ))}
                    </MessageFilesSection>
                )}

                {toolItems.length > 0 && (
                    <div className="each-row flex flex-col px-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Tool Calls ({toolItems.length})</span>
                            <CopyButton
                                text={JSON.stringify(
                                    toolItems.map((t) => ({ type: t.type, input: t.input, output: t.output })),
                                    null,
                                    2,
                                )}
                                size="small"
                            />
                        </div>
                        <div className="flex flex-col gap-2">
                            {toolItems.map((item, idx) => (
                                <ToolCallAdminItem key={`${item.toolCallId}-${idx}`} item={item} />
                            ))}
                        </div>
                    </div>
                )}

                {dataSourcesItems.map((srcItem) => (
                    <div key={srcItem.id} className="each-row flex flex-col px-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Sources ({srcItem.data.length})</span>
                            <CopyButton text={JSON.stringify(srcItem.data, null, 2)} size="small" />
                        </div>
                        <div className="flex flex-col gap-1">
                            {srcItem.data.map((source) => (
                                <SourceLink key={source.url} source={source} />
                            ))}
                        </div>
                    </div>
                ))}

                {metadataSources && (
                    <div className="each-row flex flex-col px-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Sources ({metadataSources.length})</span>
                            <CopyButton text={JSON.stringify(metadataSources, null, 2)} size="small" />
                        </div>
                        <div className="flex flex-col gap-1">
                            {metadataSources.map((source) => (
                                <SourceLink key={source.url} source={source} />
                            ))}
                        </div>
                    </div>
                )}

                {reasoning && (
                    <div className="each-row flex flex-col px-2">
                        <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Reasoning</span>
                            <CopyButton text={reasoning} size="small" />
                        </div>
                        <ExpandableText maxLines={3}>
                            <span className="text-xs">{reasoning}</span>
                        </ExpandableText>
                    </div>
                )}

                <AiInfoSection aiInfo={ai_info} isExpanded={aiInfoExpanded} onToggleExpanded={toggleAiInfo} />
            </div>
        );
    };

    return (
        <div id={`message-${message._id}`} className="chat-message collapsed-expanded accordion mx-2 py-2">
            {renderMessageHeader()}
            {isExpanded && renderMessageContent()}
        </div>
    );
};
