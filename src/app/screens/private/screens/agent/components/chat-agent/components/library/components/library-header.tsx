import {
    DownloadIcon,
    InfoIcon,
    LayoutGridIcon,
    ListIcon,
    Loader2Icon,
    SquarePenIcon,
    TrashIcon,
    XIcon,
} from 'lucide-react';

import type { AgentRef } from '@/components/agent-chat/agent-name-link';
import AgentTitlePrefix from '@/components/agent-chat/agent-title-prefix';
import type {
    LibraryFilters,
    LibraryItem,
    LibraryScope,
    LibrarySort,
} from '@/components/agent-chat/hooks/use-media-library';
import SearchInput from '@/components/search-input';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import Switch from '@/components/ui/switch';
import { lineTabTriggerClassName, Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import type { ArtifactType } from '@/lib/api/app/artifact';
import { cn } from '@/lib/utils';

import LibraryEntitySelect, { type EntitySelectOption } from '../library-entity-select';
import LibraryFilterMenu from '../library-filter-menu';
import LibrarySortMenu from '../library-sort-menu';

const SCOPES = [
    { value: 'yours', label: 'My files' },
    { value: 'shared', label: 'Shared with me' },
    { value: 'all', label: 'All files' },
] as const;

const VIEW_OPTIONS = [
    { label: 'Grid view', icon: LayoutGridIcon },
    { label: 'List view', icon: ListIcon },
];

interface Props {
    title: string;
    agent?: AgentRef | null;
    onTitleInfoClick?: () => void;
    isSticky: boolean;
    searchQuery: string;
    onSearchQueryChange: (value: string) => void;
    searchPlaceholder: string;
    scope: LibraryScope;
    onScopeChange: (scope: LibraryScope) => void;
    view: 'grid' | 'list';
    onViewChange: (view: 'grid' | 'list') => void;
    filters: LibraryFilters;
    onFiltersChange: (filters: LibraryFilters | ((prev: LibraryFilters) => LibraryFilters)) => void;
    onSortChange: (sort: LibrarySort) => void;
    artifactType?: ArtifactType;
    onArtifactTypeChange?: (artifactType?: ArtifactType) => void;
    showEntityFilters: boolean;
    agentOptions: EntitySelectOption[];
    projectOptions: EntitySelectOption[];
    isLoadingAgents: boolean;
    isLoadingProjects: boolean;
    agentSearch: string;
    onAgentSearchChange: (value: string) => void;
    projectSearch: string;
    onProjectSearchChange: (value: string) => void;
    onAgentIdChange: (agentId?: string) => void;
    onProjectIdChange: (projectId?: string) => void;
    enableSelection: boolean;
    selectionActive: boolean;
    selectedCount: number;
    itemsCount: number;
    allSelected: boolean;
    onToggleSelectAll: () => void;
    onBulkDownload: () => void;
    isBulkDownloading: boolean;
    ownedSelectedCount: number;
    onOpenBulkDelete: () => void;
    onClearSelection: () => void;
    onStartChat?: (items: LibraryItem[]) => void;
    onStartChatClick: () => void;
}

const LibraryHeader = (props: Props) => {
    const {
        title,
        agent,
        onTitleInfoClick,
        isSticky,
        searchQuery,
        onSearchQueryChange,
        searchPlaceholder,
        scope,
        onScopeChange,
        view,
        onViewChange,
        filters,
        onFiltersChange,
        onSortChange,
        artifactType,
        onArtifactTypeChange,
        showEntityFilters,
        agentOptions,
        projectOptions,
        isLoadingAgents,
        isLoadingProjects,
        agentSearch,
        onAgentSearchChange,
        projectSearch,
        onProjectSearchChange,
        onAgentIdChange,
        onProjectIdChange,
        enableSelection,
        selectionActive,
        selectedCount,
        itemsCount,
        allSelected,
        onToggleSelectAll,
        onBulkDownload,
        isBulkDownloading,
        ownedSelectedCount,
        onOpenBulkDelete,
        onClearSelection,
        onStartChat,
        onStartChatClick,
    } = props;

    const renderEntityFilters = () => {
        if (!showEntityFilters) return null;

        return (
            <div className="flex flex-wrap items-center gap-2">
                <LibraryEntitySelect
                    label="All Agents"
                    value={filters.agentId}
                    options={agentOptions}
                    onChange={onAgentIdChange}
                    searchValue={agentSearch}
                    onSearchChange={onAgentSearchChange}
                    isLoading={isLoadingAgents}
                    emptyText="No agents found."
                />
                {filters.agentId ? (
                    <LibraryEntitySelect
                        label="All Spaces"
                        value={filters.projectId}
                        options={projectOptions}
                        onChange={onProjectIdChange}
                        searchValue={projectSearch}
                        onSearchChange={onProjectSearchChange}
                        isLoading={isLoadingProjects}
                        emptyText="No spaces found."
                    />
                ) : null}
            </div>
        );
    };

    const renderViewToggle = () => (
        <Switch
            options={VIEW_OPTIONS}
            activeIndex={view === 'grid' ? 0 : 1}
            onChange={(_, index) => onViewChange(index === 0 ? 'grid' : 'list')}
            color="primary"
            width={42}
            showTooltip
            className={cn(
                'library-view-switch min-h-8! [&_.switch-item]:h-8! [&_.switch-item]:min-h-8! [&_.switch-item_span]:sr-only',
                '[&_.active-indicator]:h-8! [&_svg]:size-4',
            )}
        />
    );

    const renderSelectionActions = (className?: string) => {
        if (!enableSelection || !selectionActive) return null;

        return (
            <div className={cn('selection-actions min-h-9 shrink-0 items-center justify-between gap-3', className)}>
                <div className="selected-box flex items-center gap-2">
                    <Checkbox
                        checked={allSelected}
                        indeterminate={selectionActive && !allSelected}
                        onChange={onToggleSelectAll}
                        disabled={itemsCount === 0}
                        label="Select all"
                        labelClassName="text-sm text-text-secondary whitespace-nowrap"
                        aria-label="Select all files"
                    />
                    <span className="selection-actions-count text-sm text-text-secondary">
                        {`( ${selectedCount} selected )`}
                    </span>
                </div>
                <div className="selection-actions-buttons ml-auto flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        onClick={onBulkDownload}
                        disabled={isBulkDownloading}
                        className="cursor-pointer rounded-full text-primary hover:bg-primary/10 hover:text-primary"
                        aria-label="Download selected files"
                    >
                        {isBulkDownloading ? (
                            <Loader2Icon className="size-4 animate-spin" />
                        ) : (
                            <DownloadIcon className="size-4" />
                        )}
                        Download
                    </Button>
                    <SimpleTooltip
                        content={
                            ownedSelectedCount === 0 ? 'You can only delete your own files' : 'Delete selected files'
                        }
                        side="bottom"
                    >
                        <span className="inline-flex">
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={onOpenBulkDelete}
                                disabled={ownedSelectedCount === 0}
                                aria-label="Delete selected files"
                                className="rounded-full"
                            >
                                <TrashIcon className="size-4" />
                                Delete
                            </Button>
                        </span>
                    </SimpleTooltip>
                    <Button
                        variant="secondary"
                        size="sm"
                        aria-label="Clear selection"
                        onClick={onClearSelection}
                        className="cursor-pointer rounded-full text-text-secondary"
                    >
                        <XIcon className="size-4" />
                        Clear selection
                    </Button>
                    {onStartChat ? (
                        <SimpleTooltip content="Start a new chat with the selected files attached" side="bottom">
                            <Button
                                variant="default"
                                size="sm"
                                onClick={onStartChatClick}
                                className="cursor-pointer rounded-full"
                            >
                                <SquarePenIcon className="size-4" />
                                Start chat
                            </Button>
                        </SimpleTooltip>
                    ) : null}
                </div>
            </div>
        );
    };

    const renderScopeTabs = () => (
        <div className="flex w-full flex-wrap items-end justify-between gap-3 border-b border-border-secondary">
            {selectionActive ? (
                renderSelectionActions('hidden w-full sm:flex')
            ) : (
                <>
                    {/* Manual activation: a scope switch refetches and writes history, so arrow
                        keys must move focus without selecting, and focus must not re-fire the
                        change the click already made. */}
                    <Tabs
                        value={scope}
                        activationMode="manual"
                        onValueChange={(value) => onScopeChange(value as LibraryScope)}
                        className="min-w-0 flex-1 gap-0"
                    >
                        <TabsList
                            variant="line"
                            className="h-10 w-full flex-row! items-center! justify-start! gap-3 border-b-0 p-0"
                        >
                            {SCOPES.map(({ value, label }) => (
                                <TabsTrigger key={value} value={value} className={lineTabTriggerClassName}>
                                    {label}
                                </TabsTrigger>
                            ))}
                        </TabsList>
                    </Tabs>
                    {renderSelectionActions('hidden justify-end sm:flex')}
                </>
            )}
        </div>
    );

    const renderTitle = () => (
        <div className="flex min-w-0 flex-col gap-1">
            <div className="flex min-w-0 items-center gap-1.5">
                <AgentTitlePrefix agent={agent} />
                <h2 className="line-clamp-1 shrink-0 text-xl font-bold">{title}</h2>
                {onTitleInfoClick ? (
                    <SimpleTooltip content="Info" side="bottom">
                        <Button
                            type="button"
                            variant="ghost"
                            size="icon-xs"
                            className="shrink-0 rounded-full"
                            aria-label="Open library details"
                            onClick={onTitleInfoClick}
                        >
                            <InfoIcon className="size-4" />
                        </Button>
                    </SimpleTooltip>
                ) : null}
            </div>
        </div>
    );

    const renderHeaderActions = (className?: string) => (
        <div className={cn('library-header-actions flex shrink-0 flex-wrap items-center justify-end gap-2', className)}>
            {renderEntityFilters()}
            {!selectionActive ? (
                <>
                    <LibraryFilterMenu
                        filters={filters}
                        onChange={onFiltersChange}
                        artifactType={artifactType}
                        onArtifactTypeChange={onArtifactTypeChange}
                    />
                    <LibrarySortMenu sort={filters.sort} onChange={onSortChange} />
                </>
            ) : null}
            {renderViewToggle()}
        </div>
    );

    const renderSearch = () => (
        <div className="library-header-search flex w-full items-center gap-2">
            <SearchInput
                search={searchQuery}
                onChange={onSearchQueryChange}
                searchOnChange
                debounceWait={400}
                autoFocus={false}
                placeholder={searchPlaceholder}
                className="max-w-full"
                inputClassName="rounded-3xl border-0 shadow-surface text-base h-[45px]"
            />
        </div>
    );

    return (
        <div className={cn('library-header sticky top-0 z-1 w-full bg-background py-4', { 'shadow-sm': isSticky })}>
            <div className="library-header-content mx-auto flex w-full max-w-[928px] flex-col gap-4 px-4">
                <div className="library-header-title relative flex w-full flex-wrap items-center justify-between gap-3">
                    {renderTitle()}
                    {renderHeaderActions('ml-auto hidden sm:flex')}
                </div>
                {renderSearch()}
                <div
                    className={cn(
                        'library-header-actions-mobile flex w-full flex-wrap items-center gap-3 sm:hidden',
                        enableSelection ? 'justify-between' : 'justify-end',
                    )}
                >
                    {renderHeaderActions()}
                    {renderSelectionActions('flex flex-1 flex-wrap gap-2 sm:hidden')}
                </div>
                {renderScopeTabs()}
            </div>
        </div>
    );
};

export type { Props as LibraryHeaderProps };
export default LibraryHeader;
