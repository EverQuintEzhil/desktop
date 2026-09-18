import { useState } from 'react';

import ShowMoreButton from '@/components/show-more-button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChatAgentType } from '@/types/admin';

import { useOriginFiles } from '../../../hooks/use-origin-files';

import { conversationFileFromLibraryItem, type ConversationFile } from './conversation-file';
import ConversationFileLightbox from './conversation-file-lightbox';
import ConversationFileRow from './conversation-file-row';
import ConversationFilesEmptyState from './conversation-files-empty-state';

interface Props {
    agent: ChatAgentType;
    conversationId: string;
}

const SKELETON_COUNT = 4;

const ConversationFilesContentSection = ({ agent, conversationId }: Props) => {
    const { files, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useOriginFiles({
        originType: 'chat',
        originAgentId: agent._id,
        originConversationId: conversationId,
    });

    const [lightboxFile, setLightboxFile] = useState<ConversationFile | null>(null);

    const renderHeader = () => {
        if (isLoading || files.length === 0) {
            return <h5 className="text-sm font-medium text-foreground">Chat files</h5>;
        }

        return (
            <div className="flex items-center justify-between gap-2">
                <h5 className="text-sm font-medium text-foreground">Chat files</h5>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                    {files.length}
                    {hasNextPage ? '+' : ''}
                </span>
            </div>
        );
    };

    const renderBody = () => {
        if (isLoading) {
            return (
                <ul className="flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card">
                    {Array.from({ length: SKELETON_COUNT }).map((_, index) => (
                        <li
                            key={index}
                            className="flex items-center gap-3 border-t border-border-secondary px-4 py-3 first:border-t-0"
                        >
                            <Skeleton className="size-9 shrink-0 rounded-xl" />
                            <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                                <Skeleton className="h-3 w-2/3" />
                                <Skeleton className="h-2.5 w-1/3" />
                            </span>
                        </li>
                    ))}
                </ul>
            );
        }

        if (files.length === 0) {
            return (
                <ConversationFilesEmptyState
                    title="No files yet"
                    description="Files you attach in this chat will show up here for quick access and preview."
                    hints={['PDFs', 'Images', 'Docs']}
                />
            );
        }

        return (
            <ul className="flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card">
                {files.map((file) => (
                    <ConversationFileRow
                        key={file._id}
                        file={conversationFileFromLibraryItem(file)}
                        onOpen={setLightboxFile}
                    />
                ))}
                <ShowMoreButton hasMore={hasNextPage} isLoading={isFetchingNextPage} onClick={fetchNextPage} />
            </ul>
        );
    };

    return (
        <section className="flex flex-col gap-3">
            {renderHeader()}
            {renderBody()}
            <ConversationFileLightbox file={lightboxFile} onClose={() => setLightboxFile(null)} />
        </section>
    );
};

export default ConversationFilesContentSection;
