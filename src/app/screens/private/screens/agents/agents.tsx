import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import type { SelectSuggestionItem } from '@/components';
import InfiniteScrollTrigger from '@/components/infinite-scroll-trigger';
import { Skeleton } from '@/components/ui/skeleton';
import { useInfiniteScroll, useAppSelector, useIsDarkMode, usePersistentSearchParam } from '@/hooks';
import {
    selectHideCategoryFilter,
    selectHideCreateAgent,
    selectHideScopeSwitch,
    selectHideSearchBar,
    selectHideSearchInput,
    selectTenant,
    selectUser,
} from '@/store/selectors';
import type { LauncherType, TagType } from '@/types/admin';

import { useAgentLayout, DEFAULT_PINNED_COUNT } from './agent-layout';
import {
    Search,
    AgentCard,
    AgentSort,
    AGENT_SORTS,
    DEFAULT_AGENT_SORT,
    HomeHeader,
    PinnedAgentsSection,
} from './components';
import type { AgentSortValue, PinDisabledReason } from './components';
import {
    idsCacheKey,
    useAgentLaunchersQuery,
    useAgentTagsQuery,
    useLaunchersByIdsQuery,
    useMyAgentsByIdsQuery,
    useMyAgentsQuery,
} from './hooks/use-agents-queries';
import './agents.scss';

const AGENT_BUILDER_PATH = '/agent-builder';
const ALL_AGENTS_HEADING_ID = 'all-agents-heading';

/** The My tab has no admin-controlled order to derive defaults from. One stable identity: it is handed to the layout hook every render. */
const NO_DEFAULT_PINS: string[] = [];

const selectDefaultPinnedAgents = (agents: LauncherType[]): LauncherType[] => agents.slice(0, DEFAULT_PINNED_COUNT);

const Agents = () => {
    const tenant = useAppSelector(selectTenant);
    const isDarkMode = useIsDarkMode();
    const user = useAppSelector(selectUser);
    const hideSearchBar = useAppSelector(selectHideSearchBar);
    const hideCreateAgent = useAppSelector(selectHideCreateAgent);
    const hideScopeSwitch = useAppSelector(selectHideScopeSwitch);
    const hideCategoryFilter = useAppSelector(selectHideCategoryFilter);
    const hideSearchInput = useAppSelector(selectHideSearchInput);
    const [search, setSearch] = useState<string>('');
    const [categoryFilter, setCategoryFilter] = useState<SelectSuggestionItem<string> | null>({
        label: 'All',
        value: '',
    });
    const [storedScope, handleScopeChange] = usePersistentSearchParam('scope', {
        allowed: ['my', 'firm'] as const,
        fallback: 'firm',
    });
    const [sort, handleSortChange] = usePersistentSearchParam<AgentSortValue>('sort', {
        allowed: AGENT_SORTS,
        fallback: DEFAULT_AGENT_SORT,
    });
    // A stored 'my' scope outlives the switch being hidden, and there is then no control to leave it.
    const scope = hideScopeSwitch ? 'firm' : storedScope;
    const isMy = scope === 'my';

    useEffect(() => {
        if (hideScopeSwitch && storedScope !== 'firm') {
            handleScopeChange('firm');
        }
    }, [hideScopeSwitch, storedScope, handleScopeChange]);
    // Normalized to a string so an unfiltered grid keys on the same query as the default pins below.
    const category = categoryFilter?.value ?? '';
    const isFiltering = search.trim() !== '' || category !== '';

    const { data: tagsData, isError: isTagsError } = useAgentTagsQuery();

    const tags = useMemo(() => {
        if (!tagsData?.values) return [];

        const allTag: Pick<TagType, 'name' | 'value'> & { id: string } = {
            name: 'All',
            id: 'all',
            value: '',
        };

        return [
            allTag,
            ...tagsData.values.map((tag: TagType) => ({
                ...tag,
                value: tag.name,
                label: tag.name,
            })),
        ];
    }, [tagsData]);

    const {
        data,
        isLoading,
        isError,
        isSuccess: isFirmListLoaded,
        fetchNextPage,
        hasNextPage,
        isFetchingNextPage,
    } = useAgentLaunchersQuery(search, category, !isMy);

    /**
     * The firmwide default pins: unfiltered so a search or tag filter cannot redefine them, and
     * enabled in every scope because a firmwide pin cannot be written until the set resolves. Shares
     * the unfiltered firmwide query key, so an unfiltered grid costs no extra request.
     */
    const { data: defaultPinsData, isSuccess: areDefaultPinsResolved } = useAgentLaunchersQuery('', '', true);

    const {
        data: myData,
        isLoading: isMyLoading,
        isError: isMyError,
        isSuccess: isMyListLoaded,
        fetchNextPage: fetchMyNextPage,
        hasNextPage: hasMyNextPage,
        isFetchingNextPage: isFetchingMyNextPage,
    } = useMyAgentsQuery(user._id, isMy && !!user._id, search, sort);

    const firmAgents = useMemo(() => data?.pages.flatMap((p) => p.values) ?? [], [data]);

    const myAgents = useMemo(() => myData?.pages.flatMap((p) => p.values) ?? [], [myData]);

    const displayAgents = isMy ? myAgents : firmAgents;
    const displayLoading = isMy ? isMyLoading : isLoading;
    const displayError = isMy ? isMyError : isError;
    const isDisplayListLoaded = isMy ? isMyListLoaded : isFirmListLoaded;

    /** The active tab's default pins, or `null` while unknown, which gates every layout write. */
    const defaultPinnedIds = useMemo<string[] | null>(() => {
        if (isMy) return NO_DEFAULT_PINS;

        if (!areDefaultPinsResolved) return null;

        const firstPage = defaultPinsData?.pages[0]?.values ?? [];

        return selectDefaultPinnedAgents(firstPage).map((agent) => agent._id);
    }, [isMy, areDefaultPinsResolved, defaultPinsData]);

    const { pinnedIds, isPinnable, isLayoutWritable, pinLimit, togglePin, reorderPinned, pruneStalePins } =
        useAgentLayout({ userId: user._id ?? '', scope, defaultPinnedIds });

    const pinnedIdSet = useMemo(() => new Set(pinnedIds), [pinnedIds]);

    const agentsById = useMemo(() => new Map(displayAgents.map((agent) => [agent._id, agent])), [displayAgents]);

    const hasUnresolvedPin = useMemo(() => pinnedIds.some((id) => !agentsById.has(id)), [pinnedIds, agentsById]);

    /**
     * A pinned id can live on a page the grid has not fetched, so the records are resolved by id
     * instead of out of the grid's pages. The query is keyed on the whole pin set rather than on the
     * ids still missing, which would change as pages arrive and refetch each time.
     *
     * Fired as soon as the pin set is known rather than after the list settles, so the lookup runs
     * alongside page 0 instead of behind it. Once the list has settled `hasUnresolvedPin` takes
     * over and skips the request entirely when page 0 already carried every pin. The gate cannot
     * oscillate: a record this lookup resolves lands in `resolvedPinnedById`, never in `agentsById`,
     * so its id stays unresolved here and the query stays enabled.
     */
    const isPinnedLookupEnabled = !isFiltering && pinnedIds.length > 0 && (!isDisplayListLoaded || hasUnresolvedPin);

    const {
        data: pinnedLaunchers,
        error: launchersByIdsError,
        dataUpdatedAt: launchersByIdsUpdatedAt,
    } = useLaunchersByIdsQuery(pinnedIds, isPinnedLookupEnabled && !isMy);

    const {
        data: pinnedMyAgents,
        error: myAgentsByIdsError,
        dataUpdatedAt: myAgentsByIdsUpdatedAt,
    } = useMyAgentsByIdsQuery(user._id, pinnedIds, isPinnedLookupEnabled && isMy);

    const resolvedPinnedById = useMemo(() => {
        const resolved = (isMy ? pinnedMyAgents : pinnedLaunchers) ?? [];

        return new Map(resolved.map((agent) => [agent._id, agent]));
    }, [isMy, pinnedMyAgents, pinnedLaunchers]);

    const pinnedLookupError = isMy ? myAgentsByIdsError : launchersByIdsError;

    /**
     * Which lookup an error belongs to: the same content the query key carries, plus the scope that
     * chose the query. An `Error` object is not that identity — react-query clears `error` to `null`
     * while refetching a query that holds no data of its own and mints a fresh one when the retry
     * fails, so keying the warning on it warns again per failed attempt and per scope switch.
     */
    const pinnedLookupIdentity = useMemo(() => [scope, ...idsCacheKey(pinnedIds)].join('|'), [scope, pinnedIds]);

    /** `placeholderData` leaves `dataUpdatedAt` at 0, so a non-zero value is this key's own answer. */
    const isPinnedLookupResolved = (isMy ? myAgentsByIdsUpdatedAt : launchersByIdsUpdatedAt) > 0;

    const warnedPinnedLookupsRef = useRef<Set<string>>(new Set());

    /** The scope whose pinned row has finished resolving once; a tab switch starts a new resolution. */
    const settledPinnedScopeRef = useRef<string | null>(null);

    // One warning per lookup, released once that same lookup answers, so a later failure still warns.
    useEffect(() => {
        const warned = warnedPinnedLookupsRef.current;

        if (pinnedLookupError !== null) {
            if (warned.has(pinnedLookupIdentity)) return;

            warned.add(pinnedLookupIdentity);
            toast.error("Couldn't load some of your pinned agents. Reload the page and try again.");

            return;
        }

        if (isPinnedLookupResolved) {
            warned.delete(pinnedLookupIdentity);
        }
    }, [pinnedLookupError, pinnedLookupIdentity, isPinnedLookupResolved]);

    /** The loaded-page record wins, so a tile already on screen keeps its identity. An id that resolves to nothing has no tile. */
    const pinnedAgents = useMemo(
        () =>
            pinnedIds
                .map((id) => agentsById.get(id) ?? resolvedPinnedById.get(id))
                .filter((agent): agent is LauncherType => agent !== undefined),
        [pinnedIds, agentsById, resolvedPinnedById],
    );

    /**
     * Whether the row can still gain a tile. Rendering the pins resolvable from page 0 while the
     * by-ids lookup is outstanding would show a short row that grows a moment later, so the
     * placeholders below stand in until the set is final.
     */
    const isPinnedResolutionPending =
        !isFiltering &&
        hasUnresolvedPin &&
        settledPinnedScopeRef.current !== scope &&
        pinnedLookupError === null &&
        !isPinnedLookupResolved;

    /*
     * Latched per scope: after the first resolution a pin gesture re-keys the lookup, and swapping
     * tiles already on screen back to placeholders for that window is the same jump in reverse.
     * The list gate keeps the very first render, where nothing is pinned yet, from latching.
     */
    if (!isPinnedResolutionPending && isDisplayListLoaded) {
        settledPinnedScopeRef.current = scope;
    }

    // `isPinnedLookupResolved` gates on the current key's own answer: `keepPreviousData` serves the
    // prior key's records after a refetch adds a pin, which would misread an unfetched id as stale.
    const isPinnedReconcilable =
        !isFiltering && settledPinnedScopeRef.current === scope && pinnedLookupError === null && isPinnedLookupResolved;

    const stalePinnedIds = useMemo(
        () =>
            isPinnedReconcilable ? pinnedIds.filter((id) => !agentsById.has(id) && !resolvedPinnedById.has(id)) : [],
        [isPinnedReconcilable, pinnedIds, agentsById, resolvedPinnedById],
    );

    // At most once per mount: a failed prune save rolls the id back, and re-firing would storm.
    const attemptedPruneRef = useRef<Set<string>>(new Set());

    useEffect(() => {
        const attempted = attemptedPruneRef.current;
        const toPrune = stalePinnedIds.filter((id) => !attempted.has(id));

        if (toPrune.length === 0) return;

        toPrune.forEach((id) => attempted.add(id));
        pruneStalePins(toPrune);
    }, [stalePinnedIds, pruneStalePins]);

    const isPinnedSectionVisible = !isFiltering && (pinnedAgents.length > 0 || isPinnedResolutionPending);

    const gridAgents = isPinnedSectionVisible
        ? displayAgents.filter((agent) => !pinnedIdSet.has(agent._id))
        : displayAgents;

    const { loadMoreRef } = useInfiniteScroll({
        loading: isMy ? isMyLoading : isLoading,
        showMoreLoading: isMy ? isFetchingMyNextPage : isFetchingNextPage,
        hasMore: isMy ? hasMyNextPage : hasNextPage,
        itemsLength: displayAgents.length,
        onLoadMore: isMy ? fetchMyNextPage : fetchNextPage,
    });

    const resolvePinDisabledReason = (isAgentPinned: boolean): PinDisabledReason | undefined => {
        if (!isLayoutWritable) return 'unavailable';

        if (!isPinnable && !isAgentPinned) return 'limit';

        return undefined;
    };

    const renderSkeletonCard = () => (
        <>
            <div className="flex w-full flex-col">
                <Skeleton className="h-7 w-full rounded-xl" />
                <div className="my-8 flex w-full flex-col gap-1.5">
                    <Skeleton className="h-4 w-full rounded-xl" />
                    <Skeleton className="h-4 w-full rounded-xl" />
                </div>
            </div>
            <Skeleton className="mt-auto ml-auto size-4 shrink-0 rounded-full" />
        </>
    );

    /*
     * A standalone block rather than placeholder entries handed to `PinnedAgentsSection`: its list
     * is the dnd-kit reorder collection, and an id in there that no tile owns can misaddress a drop.
     */
    const renderPinnedPlaceholder = () => (
        <section
            className="agents-section pinned-agents-section flex flex-col"
            aria-busy="true"
            aria-label="Loading pinned agents"
        >
            <h3 className="agents-section-heading">Pinned</h3>
            <div className="agents-block grid grid-cols-[repeat(auto-fill,minmax(255px,1fr))] gap-6 pt-4 pb-1">
                {pinnedIds.map((id) => (
                    <div
                        className="agent-card flex w-full flex-col gap-6 rounded-3xl bg-card px-6 pt-8 pb-3"
                        key={`pinned-skeleton-${id}`}
                    >
                        {renderSkeletonCard()}
                    </div>
                ))}
            </div>
        </section>
    );

    const renderPinnedSection = () => {
        if (!isPinnedSectionVisible) return null;

        if (isPinnedResolutionPending) return renderPinnedPlaceholder();

        return (
            <PinnedAgentsSection
                agents={pinnedAgents}
                editToPrefix={isMy ? AGENT_BUILDER_PATH : undefined}
                isOwned={isMy}
                pinDisabledReason={resolvePinDisabledReason(true)}
                onTogglePin={togglePin}
                onReorder={reorderPinned}
            />
        );
    };

    /** Scoped to the grid, not the page: the pinned row is hand-ordered and no sort applies to it. */
    const renderGridSort = () => {
        if (!isMy) return null;

        return <AgentSort value={sort} onChange={handleSortChange} />;
    };

    const renderAgentGrid = () => {
        const grid = (
            <div className="agents-block grid grid-cols-[repeat(auto-fill,minmax(255px,1fr))] gap-6">
                {gridAgents.map((agent) => (
                    <AgentCard
                        key={agent._id}
                        agent={agent}
                        editTo={isMy ? `${AGENT_BUILDER_PATH}/${agent._id}` : undefined}
                        isOwned={isMy}
                        isPinned={pinnedIdSet.has(agent._id)}
                        pinDisabledReason={resolvePinDisabledReason(pinnedIdSet.has(agent._id))}
                        pinLimit={pinLimit}
                        onTogglePin={() => togglePin(agent._id)}
                    />
                ))}
            </div>
        );

        const sortControl = renderGridSort();

        if (!isPinnedSectionVisible) {
            return (
                <section className="agents-grid-section flex flex-col gap-4" aria-label="Agents">
                    {sortControl && (
                        <div className="agents-grid-section-header flex items-center justify-end">{sortControl}</div>
                    )}
                    {grid}
                </section>
            );
        }

        return (
            <section className="agents-grid-section flex flex-col gap-4" aria-labelledby={ALL_AGENTS_HEADING_ID}>
                <div className="agents-grid-section-header flex items-center justify-between gap-4">
                    <h2 id={ALL_AGENTS_HEADING_ID} className="agents-section-heading">
                        All agents
                    </h2>
                    {sortControl}
                </div>
                {grid}
            </section>
        );
    };

    const renderAgents = () => {
        if (displayLoading) {
            const skeletonCount = 4;

            return (
                <section className="main-section flex-1" aria-busy="true" aria-label="Loading agents">
                    <div className="agents-block grid grid-cols-[repeat(auto-fill,minmax(255px,1fr))] gap-6">
                        {Array.from({ length: skeletonCount }, (_, index) => (
                            <div
                                className="agent-card flex w-full flex-col gap-6 rounded-3xl bg-card px-6 pt-8 pb-3"
                                key={`agent-skeleton-${index}`}
                            >
                                {renderSkeletonCard()}
                            </div>
                        ))}
                    </div>
                </section>
            );
        }
        if (displayError) {
            return (
                <div className="flex items-center justify-center">
                    <div className="flex flex-col items-center justify-center gap-6">
                        <h2 className="text-center font-medium">Error Occurred</h2>
                    </div>
                </div>
            );
        }
        if (displayAgents.length === 0) {
            return (
                <div className="flex items-center justify-center">
                    <div className="flex flex-col items-center justify-center gap-6">
                        <h2 className="text-center font-medium">No Agents Found</h2>
                    </div>
                </div>
            );
        }

        return (
            <>
                {renderPinnedSection()}
                {renderAgentGrid()}
            </>
        );
    };

    return (
        <div className="agents-wrapper flex min-h-svh flex-col bg-background">
            <HomeHeader tenant={tenant} scope={scope} onScopeChange={handleScopeChange} />
            <div className="agents-main pb-8 lg:pb-16">
                <div className="mx-auto flex w-full max-w-[1520px] flex-col gap-10 px-4 max-sm:gap-6 lg:gap-20 lg:px-10">
                    <div className="agent-info flex max-w-[540px] items-start gap-1">
                        <h1 className="brand-name flex h-14 max-w-[180px] items-center font-bold lg:h-[78px] lg:max-w-[240px]">
                            <img
                                className="h-full max-w-full"
                                src={
                                    isDarkMode && tenant.logoWhite !== ''
                                        ? tenant.logoWhite
                                        : tenant.logoHorizontal || tenant.logoWhite
                                }
                                alt={tenant.name}
                            />
                        </h1>
                    </div>

                    <div className="flex flex-col gap-10 max-sm:gap-6">
                        {hideSearchBar ? null : (
                            <Search
                                search={search}
                                setSearch={setSearch}
                                categoryFilter={categoryFilter}
                                setCategoryFilter={setCategoryFilter}
                                tags={isTagsError ? [] : tags}
                                tenant={tenant}
                                createAgentTo={hideCreateAgent ? undefined : AGENT_BUILDER_PATH}
                                hideCategoryFilter={hideCategoryFilter}
                                hideSearchInput={hideSearchInput}
                            />
                        )}
                        {renderAgents()}
                        <InfiniteScrollTrigger
                            isLoading={isMy ? isFetchingMyNextPage : isFetchingNextPage}
                            hasMore={isMy ? hasMyNextPage : hasNextPage}
                            loadMoreRef={loadMoreRef}
                        />
                    </div>
                </div>
            </div>
        </div>
    );
};

export default Agents;
