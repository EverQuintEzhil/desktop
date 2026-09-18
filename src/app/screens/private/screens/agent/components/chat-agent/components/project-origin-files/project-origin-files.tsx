import { FileIcon } from 'lucide-react';
import { useState } from 'react';

import { useInfiniteScroll } from '@/app/hooks';
import { FileRowsSkeleton } from '@/components/file-list';
import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import SearchInput from '@/components/search-input';
import { cn } from '@/lib/utils';

import { SPACE_ACTIVITY_ORIGIN_TYPES, useOriginFiles } from '../../hooks/use-origin-files';
import { conversationFileFromLibraryItem, type ConversationFile } from '../chat/conversation-files/conversation-file';
import ConversationFileLightbox from '../chat/conversation-files/conversation-file-lightbox';
import ConversationFileRow from '../chat/conversation-files/conversation-file-row';
import { STICKY_TAB_SEARCH_CLASS_NAME } from '../project-detail/constants';

interface Props {
    projectId?: string;
    // Required: the server needs it to resolve this space's chats, and without it the
    // list comes back empty instead of failing.
    agentId: string;
}

const LIST_CLASS_NAME = 'flex flex-col overflow-hidden rounded-2xl border border-border-secondary bg-card';

const ProjectOriginFiles = ({ projectId, agentId }: Props) => {
    const [search, setSearch] = useState('');
    const trimmedSearch = search.trim();

    const { files, isLoading, hasNextPage, fetchNextPage, isFetchingNextPage } = useOriginFiles(
        {
            projectChatId: projectId,
            agentId,
            // `projectChatId` already pins the server side to `origin.type = 'chat'`; these types
            // stay as the explicit guard that knowledge uploads (`origin.type = 'project'`) never leak in.
            originTypes: SPACE_ACTIVITY_ORIGIN_TYPES,
            search: trimmedSearch,
        },
        { enabled: Boolean(projectId && agentId) },
    );

    const { loadMoreRef } = useInfiniteScroll({
        loading: isLoading,
        showMoreLoading: isFetchingNextPage,
        hasMore: hasNextPage,
        itemsLength: files.length,
        onLoadMore: fetchNextPage,
    });

    const [lightboxFile, setLightboxFile] = useState<ConversationFile | null>(null);

    // Nothing to search until this space has produced a file, but an active term always keeps the
    // input mounted so a zero-result search cannot pull it out from under the user.
    const showSearch = Boolean(trimmedSearch) || files.length > 0;

    const renderSearch = () => (
        <div className={cn('project-origin-files-search', STICKY_TAB_SEARCH_CLASS_NAME)}>
            <SearchInput
                search={search}
                onChange={setSearch}
                searchOnChange
                debounceWait={400}
                autoFocus={false}
                placeholder="Search files"
                inputClassName="rounded-2xl border-0 shadow-surface h-11"
            />
        </div>
    );

    const renderBody = () => {
        // Covers a new search term too: its query starts empty, and without this the empty
        // state would flash "No matching files" before the results land.
        if (isLoading) return <FileRowsSkeleton />;

        if (files.length === 0) {
            return (
                <div className="flex min-h-[220px] flex-col items-center justify-center gap-2 rounded-2xl border border-border-secondary bg-card p-6 text-center">
                    <span className="flex size-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                        <FileIcon className="size-6" />
                    </span>
                    <span className="text-sm font-medium">{trimmedSearch ? 'No matching files' : 'No files yet'}</span>
                    <span className="max-w-sm text-sm text-text-secondary">
                        {trimmedSearch
                            ? `No files in this space match "${trimmedSearch}".`
                            : 'Files uploaded or generated in this space appear here, including the ones from its chats.'}
                    </span>
                </div>
            );
        }

        return (
            <ul className={LIST_CLASS_NAME}>
                {files.map((file) => (
                    <ConversationFileRow
                        key={file._id}
                        file={conversationFileFromLibraryItem(file)}
                        onOpen={setLightboxFile}
                        showCreator
                    />
                ))}
                <li className="list-none">
                    <InfiniteScrollTrigger
                        loadMoreRef={loadMoreRef}
                        hasMore={hasNextPage}
                        isLoading={isFetchingNextPage}
                    />
                </li>
            </ul>
        );
    };

    return (
        <div className="project-origin-files flex min-h-[60svh] w-full flex-col gap-4">
            {showSearch ? renderSearch() : null}
            {renderBody()}
            <ConversationFileLightbox file={lightboxFile} onClose={() => setLightboxFile(null)} showCreator />
        </div>
    );
};

export default ProjectOriginFiles;
