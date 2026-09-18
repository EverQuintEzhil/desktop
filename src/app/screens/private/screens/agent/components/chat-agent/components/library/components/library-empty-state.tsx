import { FileIcon, ImageIcon, Share2Icon, SparklesIcon } from 'lucide-react';

import type { LibraryScope } from '@/components/agent-chat/hooks/use-media-library';
import { Button } from '@/components/ui/button';

const EMPTY_STATE_ACTIONS = [
    { label: 'Uploads', Icon: FileIcon },
    { label: 'Generated assets', Icon: SparklesIcon },
    { label: 'Shared files', Icon: Share2Icon },
];

interface Props {
    scope: LibraryScope;
    agentId?: string;
    hasActiveFilters: boolean;
    onClearFilters: () => void;
}

const renderEmptyTitle = (scope: LibraryScope, hasActiveFilters: boolean) => {
    if (hasActiveFilters) return 'No matching files';
    if (scope === 'yours') return 'Your library is ready';
    if (scope === 'shared') return 'Nothing shared yet';

    return 'No files in this library yet';
};

const renderEmptyDescription = (scope: LibraryScope, agentId: string | undefined, hasActiveFilters: boolean) => {
    if (hasActiveFilters) return 'Try a broader search, switch tabs, or clear filters to see more results.';
    if (scope === 'yours') {
        return agentId
            ? 'Uploads and generated assets you create with this agent will appear here.'
            : 'Uploads and generated assets you create will appear here.';
    }
    if (scope === 'shared') return 'Files shared by teammates will show up here when they are available.';

    return 'Uploads, generated assets, and shared files will appear here as the library grows.';
};

const LibraryEmptyState = (props: Props) => {
    const { scope, agentId, hasActiveFilters, onClearFilters } = props;

    return (
        <div className="relative min-h-[48svh] overflow-hidden rounded-3xl border border-border-secondary bg-card px-4 py-8 text-center sm:p-10">
            <div className="relative mx-auto flex min-h-[36svh] max-w-xl flex-col items-center justify-center gap-6">
                <div className="relative">
                    <span className="absolute top-8 -left-10 hidden size-12 rotate-[-10deg] items-center justify-center rounded-2xl bg-primary/8 text-primary sm:flex">
                        <ImageIcon className="size-5" />
                    </span>
                    <span className="absolute top-8 -right-10 hidden size-12 rotate-10 items-center justify-center rounded-2xl bg-primary/8 text-primary sm:flex">
                        <SparklesIcon className="size-5" />
                    </span>
                    <span className="flex size-16 items-center justify-center rounded-3xl bg-primary text-primary-foreground shadow-[0_16px_40px] shadow-primary/22">
                        <FileIcon className="size-7" />
                    </span>
                </div>

                <div className="flex max-w-md flex-col items-center gap-2">
                    <span className="text-lg font-semibold text-foreground">
                        {renderEmptyTitle(scope, hasActiveFilters)}
                    </span>
                    <span className="text-sm leading-6 text-text-secondary">
                        {renderEmptyDescription(scope, agentId, hasActiveFilters)}
                    </span>
                </div>

                {hasActiveFilters ? (
                    <Button variant="secondary" size="sm" className="rounded-full" onClick={onClearFilters}>
                        Clear search and filters
                    </Button>
                ) : (
                    <div className="flex flex-wrap items-center justify-center gap-2">
                        {EMPTY_STATE_ACTIONS.map(({ label, Icon }) => (
                            <span
                                key={label}
                                className="flex items-center gap-2 rounded-full border border-border-secondary bg-background px-3 py-1.5 text-xs font-medium text-text-secondary"
                            >
                                <Icon className="size-3.5 text-primary" />
                                {label}
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export type { Props as LibraryEmptyStateProps };
export default LibraryEmptyState;
