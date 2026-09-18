import { FolderIcon } from 'lucide-react';
import { useState } from 'react';

import { useProject } from '@/components/agent-chat/hooks/use-projects';
import ShowMoreButton from '@/components/show-more-button';
import { Skeleton } from '@/components/ui/skeleton';
import type { ChatAgentType } from '@/types/admin';

import { conversationFileFromProjectFile, type ConversationFile } from './conversation-file';
import ConversationFileLightbox from './conversation-file-lightbox';
import ConversationFileRow from './conversation-file-row';
import ConversationFilesEmptyState from './conversation-files-empty-state';

interface Props {
    agent: ChatAgentType;
    projectId: string;
}

const SKELETON_COUNT = 3;

const ConversationFilesProjectSection = ({ agent, projectId }: Props) => {
    const { files, isFilesLoading, hasNextFilesPage, isFetchingNextFilesPage, fetchNextFilesPage } = useProject(
        agent._id,
        projectId,
    );

    const [lightboxFile, setLightboxFile] = useState<ConversationFile | null>(null);

    const renderHeader = () => {
        if (isFilesLoading || files.length === 0) {
            return <h5 className="text-sm font-medium text-foreground">Space files</h5>;
        }

        return (
            <div className="flex items-center justify-between gap-2">
                <h5 className="text-sm font-medium text-foreground">Space files</h5>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-text-secondary">
                    {files.length}
                    {hasNextFilesPage ? '+' : ''}
                </span>
            </div>
        );
    };

    const renderFiles = () => {
        if (isFilesLoading) {
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
                    title="No space files yet"
                    description="Files added to this space will appear here for everyone in the conversation."
                    Icon={FolderIcon}
                    hints={['Shared', 'Persistent']}
                />
            );
        }

        return (
            <ul className="flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card">
                {files.map((file) => (
                    <ConversationFileRow
                        key={file._id}
                        file={conversationFileFromProjectFile(file)}
                        onOpen={setLightboxFile}
                    />
                ))}
                <ShowMoreButton
                    hasMore={hasNextFilesPage}
                    isLoading={isFetchingNextFilesPage}
                    onClick={fetchNextFilesPage}
                />
            </ul>
        );
    };

    return (
        <section className="flex flex-col gap-3">
            {renderHeader()}
            {renderFiles()}
            <ConversationFileLightbox file={lightboxFile} onClose={() => setLightboxFile(null)} />
        </section>
    );
};

export default ConversationFilesProjectSection;
