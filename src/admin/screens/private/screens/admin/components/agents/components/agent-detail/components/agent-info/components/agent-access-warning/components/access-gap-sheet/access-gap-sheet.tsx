import { ArrowLeftIcon, SearchIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import QueryStateBoundary from '@/admin/components/query-state-boundary';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SideSheet from '@/components/ui/side-sheet';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { type AccessPrincipalKind } from '@/lib/api/admin/agent-access-check';

import { isBulkSelectable } from '../../../../../agent-access/access-coverage';
import type { GroupGap, PrincipalGap } from '../../use-agent-access-gaps';

import GapListView from './components/gap-list-view';
import GroupDetailView from './components/group-detail-view';
import GroupListView from './components/group-list-view';
import ItemStateMenu from './components/item-state-menu';
import PrincipalDetailView, { type DetailBulkAction, type DetailSelection } from './components/principal-detail-view';
import type { ActionPrincipal, GapPair, PeopleSelection } from './types';
import type { AccessAction, AccessActionTarget } from './use-access-actions';
import { useAccessActions } from './use-access-actions';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    agentId: string;
    title: string;
    /** Either read failed: the lists are unfounded, not empty, and must not read as all-clear. */
    hasFailedRead: boolean;
    principalKind: AccessPrincipalKind;
    groups: GroupGap[];
    people: PrincipalGap[];
    droppedCount: number;
    canGrant: boolean;
    /** Reads both payloads again, for the Retry the failed-read state offers. */
    onRetry: () => void;
}

type ViewMode = 'all' | 'needs-action';

/** The people list is a group of its own as far as an in-flight bulk verb is concerned; every other
 *  scope is a capability kind. */
const PEOPLE_SCOPE = 'people';

const withoutScope = (pending: Record<string, DetailBulkAction>, scope: string): Record<string, DetailBulkAction> =>
    Object.fromEntries(Object.entries(pending).filter(([key]) => key !== scope));

// A segmented switch, not the underline tab strip: this picks how much of one list to show
// rather than swapping between two panels. The active segment carries the primary accent so the
// choice is legible at a glance, which the default near-black-on-white segment was not.
const TAB_TRIGGER_CLASS =
    'h-6 rounded-md px-2.5 text-xs font-medium text-text-secondary after:hidden hover:text-primary ' +
    'data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-none';

const AccessGapSheet = (props: Props) => {
    const {
        isOpen,
        onClose,
        agentId,
        title,
        principalKind,
        groups,
        people,
        droppedCount,
        canGrant,
        hasFailedRead,
        onRetry,
    } = props;
    const { run, runMany } = useAccessActions(agentId);
    const [selectedGroupId, setSelectedGroupId] = useState<string | null>(null);
    const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);
    const [query, setQuery] = useState('');
    const [selectedItemIds, setSelectedItemIds] = useState<Set<string>>(new Set());
    const [selectedPeopleIds, setSelectedPeopleIds] = useState<Set<string>>(new Set());
    // No write paints before the server answers, so the control that started one has to say it is
    // working — and refuse a second click while it is. The key is the group a bulk verb belongs to.
    const [pendingItemIds, setPendingItemIds] = useState<string[]>([]);
    // Keyed by scope, not one slot for the sheet: two groups can have a batch in flight at once,
    // and one settling must not re-arm the other's buttons mid-write.
    const [pendingBulk, setPendingBulk] = useState<Record<string, DetailBulkAction>>({});
    // Needs action is the default: the sheet opens from a warning, so the first thing shown is
    // what the warning was about; All is the step back for context.
    const [viewMode, setViewMode] = useState<ViewMode>('needs-action');

    const isGroupSheet = principalKind === 'securityGroup';

    /**
     * The Access tab's rule, not a stricter one of our own: `canGrant` already mirrors the exact
     * gate the write will hit, and where the endpoint stays silent the viewer keeps the action and
     * learns from the 403 rather than losing one they may legitimately hold. Two answers for the
     * same viewer on the same item is the worse failure.
     */
    const canWriteAcl = ({ canGrant: itemCanGrant }: GapPair): boolean => canGrant && itemCanGrant !== false;

    // Derived, never stored: a person granted their last item disappears from `people` and the
    // sheet falls back on its own; a group whose last gap closes does the same.
    const selectedGroup = groups.find((group) => group.id === selectedGroupId) ?? null;
    const selectedPerson = people.find((person) => person.id === selectedPersonId) ?? null;
    const hasStaleGroup = selectedGroupId !== null && selectedGroup === null;
    const hasStaleSelection = selectedPersonId !== null && selectedPerson === null;
    const isNeedsAction = viewMode === 'needs-action';

    // A dormant id would silently re-open the detail view if a later refetch brought that person
    // or group back, so drop it as soon as the lookup misses.
    useEffect(() => {
        if (hasStaleSelection) setSelectedPersonId(null);
    }, [hasStaleSelection]);

    useEffect(() => {
        // Keep the group level while a person is open: granting a member's last gap may close the
        // group's shortfall, and yanking two levels at once would strand the admin mid-action.
        if (hasStaleGroup && selectedPersonId === null) setSelectedGroupId(null);
    }, [hasStaleGroup, selectedPersonId]);

    // The query filters whichever level is on screen, so a leftover term from the previous level
    // would silently empty the next one.
    const goToGroup = (groupId: string | null) => {
        setQuery('');
        setSelectedPeopleIds(new Set());
        setSelectedGroupId(groupId);
    };

    const goToPerson = (personId: string | null) => {
        setQuery('');
        setSelectedItemIds(new Set());
        setSelectedPeopleIds(new Set());
        setSelectedPersonId(personId);
    };

    const onSheetClose = () => {
        setQuery('');
        setSelectedItemIds(new Set());
        setSelectedPeopleIds(new Set());
        setSelectedGroupId(null);
        setSelectedPersonId(null);
        onClose();
    };

    const matchesQuery = (text: string): boolean => text.toLowerCase().includes(query.trim().toLowerCase());

    const itemsOf = (person: PrincipalGap) =>
        (isNeedsAction ? person.items.filter((item) => item.state === 'missing') : person.items).filter((item) =>
            matchesQuery(item.itemName),
        );

    const visiblePeople = (isNeedsAction ? people.filter((person) => person.needsActionCount > 0) : people).filter(
        (person) => matchesQuery(person.name),
    );

    const visibleGroups = (isNeedsAction ? groups.filter((group) => group.needsActionCount > 0) : groups).filter(
        (group) => matchesQuery(group.name),
    );

    const membersOf = (group: GroupGap) => visiblePeople.filter((person) => group.memberIds.includes(person.id));

    const renderRowActionsFor = (person: PrincipalGap) => (item: PrincipalGap['items'][number]) => {
        const pair = toPair(person, item);

        return (
            <ItemStateMenu
                pair={pair}
                canWriteAcl={canWriteAcl(pair)}
                // The ignore route is gated on administering the *agent*, which is exactly the right
                // the Info tab already handed us; an ACL write can still be refused per item.
                canIgnore={canGrant}
                // Absent from the payload means the api did not say, which reads as it did before the
                // backend learned to tell us; only an explicit false withdraws the action.
                canExclude={pair.excludable !== false}
                isPending={pendingItemIds.includes(pair.itemId)}
                onAction={(action: AccessAction) => {
                    runRow(
                        pair.itemId,
                        run({
                            action,
                            kind: pair.itemKind,
                            itemId: pair.itemId,
                            itemName: pair.itemName,
                            canGrant: pair.canGrant,
                            principalKind: pair.principalKind,
                            principals: [pair.principal],
                            state: pair.state,
                        }),
                    );
                }}
            />
        );
    };

    const toPrincipal = (person: PrincipalGap): ActionPrincipal => ({
        id: person.id,
        name: person.name,
        // The sheet offers no item action to someone whose role reads through every ACL, so this
        // only ever reaches a prediction as false.
        isPlatformAdmin: person.bypassesAccessLists,
        viaGroups: person.viaGroups,
    });

    const toPair = (person: PrincipalGap, item: PrincipalGap['items'][number]): GapPair => ({
        itemId: item.itemId,
        itemName: item.itemName,
        itemKind: item.itemKind,
        canGrant: item.canGrant,
        excludable: item.excludable,
        principal: toPrincipal(person),
        principalKind: 'user',
        state: item.state,
    });

    const buildSelection = (person: PrincipalGap): DetailSelection | undefined => {
        if (person.bypassesAccessLists) return undefined;

        return {
            selectedIds: selectedItemIds,
            isSelectable: (item) => isRowSelectable(person, item),
            onToggle: (itemId: string, selected: boolean) => toggleItems([itemId], selected),
            onToggleMany: toggleItems,
            // No ask: every one of these is undoable from the row it lands on, and the toast that
            // follows says what happened — the same bargain the Access tab already makes.
            onBulk: (action: DetailBulkAction, items: PrincipalGap['items']) => runItemsBulk(action, person, items),
            pendingOf: (kind: string) => pendingBulk[kind] ?? null,
        };
    };

    const toggleItems = (itemIds: string[], selected: boolean) =>
        setSelectedItemIds((previous) => {
            const next = new Set(previous);

            itemIds.forEach((itemId) => (selected ? next.add(itemId) : next.delete(itemId)));

            return next;
        });

    const toTarget = (
        action: AccessAction,
        person: PrincipalGap,
        item: PrincipalGap['items'][number],
    ): AccessActionTarget => ({
        action,
        kind: item.itemKind,
        itemId: item.itemId,
        itemName: item.itemName,
        canGrant: item.canGrant,
        principalKind: 'user',
        principals: [toPrincipal(person)],
        state: item.state,
    });

    const runRow = (itemId: string, write: Promise<unknown>) => {
        setPendingItemIds((previous) => [...previous, itemId]);
        void write.finally(() => setPendingItemIds((previous) => previous.filter((id) => id !== itemId)));
    };

    const runItemsBulk = (action: DetailBulkAction, person: PrincipalGap, items: PrincipalGap['items']) => {
        const targets = items.map((item) => toTarget(action, person, item));

        if (targets.length === 0) return;

        const scope = items[0].itemKind;

        setPendingBulk((previous) => ({ ...previous, [scope]: action }));

        // Cleared only on a clean run, and only the rows this batch acted on: ticks in another
        // group are someone else's pending work.
        void runMany(targets)
            .then((failures) => {
                if (failures === 0) {
                    toggleItems(
                        items.map((item) => item.itemId),
                        false,
                    );
                }
            })
            .finally(() => setPendingBulk((previous) => withoutScope(previous, scope)));
    };

    /** The Access tab's own rule, shared rather than restated: every state has a bulk verb except a
     *  covered row the item cannot exclude. */
    const isRowSelectable = (person: PrincipalGap, item: PrincipalGap['items'][number]): boolean =>
        isBulkSelectable(
            canWriteAcl(toPair(person, item)),
            item.state === 'granted',
            { isPlatformAdmin: person.bypassesAccessLists },
            item,
        );

    const isItemGrantable = (person: PrincipalGap, item: PrincipalGap['items'][number]): boolean =>
        item.state === 'missing' && canWriteAcl(toPair(person, item));

    const isPersonSelectable = (person: PrincipalGap): boolean =>
        !person.bypassesAccessLists && person.items.some((item) => isItemGrantable(person, item));

    // The current people list: members when a group is open, the sheet's list otherwise.
    const peopleInView = (): PrincipalGap[] => (selectedGroup ? membersOf(selectedGroup) : visiblePeople);

    const chosenPeople = (): PrincipalGap[] =>
        peopleInView().filter((person) => isPersonSelectable(person) && selectedPeopleIds.has(person.id));

    const executePeopleGrant = () => {
        const chosen = chosenPeople();
        // One ACL write per capability, every chosen person in it: the write is a
        // read-modify-replace of the whole list, so per-person writes would just repeat it.
        const byItem = new Map<string, { person: PrincipalGap; item: PrincipalGap['items'][number] }[]>();

        chosen.forEach((person) => {
            person.items
                .filter((item) => isItemGrantable(person, item))
                .forEach((item) => {
                    const rows = byItem.get(item.itemId) ?? [];

                    rows.push({ person, item });
                    byItem.set(item.itemId, rows);
                });
        });

        const targets = [...byItem.values()].map((rows): AccessActionTarget => ({
            action: 'grant',
            kind: rows[0].item.itemKind,
            itemId: rows[0].item.itemId,
            itemName: rows[0].item.itemName,
            canGrant: rows[0].item.canGrant,
            principalKind: 'user',
            principals: rows.map((row) => toPrincipal(row.person)),
        }));

        if (targets.length === 0) return;

        setPendingBulk((previous) => ({ ...previous, [PEOPLE_SCOPE]: 'grant' }));

        // Cleared only on a clean run, and only the people this batch acted on: nothing disables a
        // row while it runs, so a tick added meanwhile is someone's pending work, not this batch's.
        void runMany(targets)
            .then((failures) => {
                if (failures !== 0) return;

                const done = new Set(chosen.map((person) => person.id));

                setSelectedPeopleIds((previous) => new Set([...previous].filter((id) => !done.has(id))));
            })
            .finally(() => setPendingBulk((previous) => withoutScope(previous, PEOPLE_SCOPE)));
    };

    const buildPeopleSelection = (): PeopleSelection => {
        return {
            selectedIds: selectedPeopleIds,
            isSelectable: isPersonSelectable,
            onToggle: (personId: string, selected: boolean) => {
                setSelectedPeopleIds((previous) => {
                    const next = new Set(previous);

                    if (selected) next.add(personId);
                    else next.delete(personId);

                    return next;
                });
            },
            onGrantSelected: executePeopleGrant,
            isPending: pendingBulk[PEOPLE_SCOPE] !== undefined,
        };
    };

    const renderSearch = () => (
        <div className="access-gap-sheet-search relative">
            <SearchIcon className="pointer-events-none absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-text-secondary" />
            <Input
                className="h-8 pl-8 text-sm"
                placeholder="Search"
                value={query}
                onChange={(event) => setQuery(event.currentTarget.value)}
            />
        </div>
    );

    // The views' own empty states read as verdicts (full coverage), which a filter that matched
    // nothing must never imply.
    const renderNoMatches = () => <p className="text-sm text-text-secondary">Nothing matches your search.</p>;

    const isSearching = query.trim().length > 0;

    const renderLevel = () => {
        if (selectedPerson) {
            const items = itemsOf(selectedPerson);

            if (isSearching && items.length === 0) return renderNoMatches();

            return (
                <PrincipalDetailView
                    items={items}
                    allItems={selectedPerson.items}
                    renderRowActions={
                        selectedPerson.bypassesAccessLists ? undefined : renderRowActionsFor(selectedPerson)
                    }
                    selection={buildSelection(selectedPerson)}
                />
            );
        }

        if (isGroupSheet) {
            if (selectedGroup) {
                const members = membersOf(selectedGroup);

                if (isSearching && members.length === 0) return renderNoMatches();

                return (
                    <GroupDetailView
                        members={members}
                        isFiltered={isNeedsAction}
                        onSelectPerson={goToPerson}
                        selection={buildPeopleSelection()}
                    />
                );
            }

            if (isSearching && visibleGroups.length === 0) return renderNoMatches();

            return (
                <GroupListView
                    groups={visibleGroups}
                    isFiltered={isNeedsAction}
                    droppedCount={droppedCount}
                    onSelectGroup={goToGroup}
                />
            );
        }

        if (isSearching && visiblePeople.length === 0) return renderNoMatches();

        return (
            <GapListView
                people={visiblePeople}
                isFiltered={isNeedsAction}
                droppedCount={droppedCount}
                onSelectPerson={goToPerson}
                selection={buildPeopleSelection()}
            />
        );
    };

    // The Access tab's own boundary, so a failed read offers the same Retry here as it does there
    // rather than asking for a page reload.
    const renderBody = () => (
        <QueryStateBoundary
            isError={hasFailedRead}
            hasData={false}
            onRetry={onRetry}
            errorMessage="Could not load who has access to this agent."
        >
            <div className="access-gap-sheet-body flex flex-col gap-3">
                {renderSearch()}
                {renderLevel()}
            </div>
        </QueryStateBoundary>
    );

    // Always present on both sheets: a control that comes and goes reads as two different UIs.
    const renderViewSwitcher = () => {
        return (
            <Tabs
                value={viewMode}
                onValueChange={(value: string) => setViewMode(value === 'all' ? 'all' : 'needs-action')}
                className="access-gap-sheet-view-switcher shrink-0"
            >
                <TabsList className="h-7 gap-0.5 bg-muted p-0.5">
                    <TabsTrigger value="needs-action" className={TAB_TRIGGER_CLASS}>
                        Needs action
                    </TabsTrigger>
                    <TabsTrigger value="all" className={TAB_TRIGGER_CLASS}>
                        All
                    </TabsTrigger>
                </TabsList>
            </Tabs>
        );
    };

    const renderBackTitle = (label: string, onBack: () => void, subtitle?: string) => (
        <div className="access-gap-sheet-back-title flex items-center gap-2">
            <Button variant="ghost" size="icon-sm" className="shrink-0" aria-label="Back" onClick={onBack}>
                <ArrowLeftIcon />
            </Button>
            <span className="flex min-w-0 flex-1 items-baseline gap-2">
                <span className="truncate">{label}</span>
                {subtitle ? <span className="truncate text-xs font-normal text-text-secondary">{subtitle}</span> : null}
            </span>
            {renderViewSwitcher()}
        </div>
    );

    const renderTitle = () => {
        if (selectedPerson) {
            const via =
                selectedPerson.viaGroups.length > 0
                    ? `via ${selectedPerson.viaGroups.map((group) => group.name).join(', ')}`
                    : undefined;

            return renderBackTitle(selectedPerson.name, () => goToPerson(null), via);
        }

        if (selectedGroup) {
            return renderBackTitle(selectedGroup.name, () => goToGroup(null));
        }

        return (
            <div className="access-gap-sheet-title flex items-center justify-between gap-2">
                <span className="truncate">{title}</span>
                {renderViewSwitcher()}
            </div>
        );
    };

    return (
        // Wider than the default: a capability group header carries a tick, its name, the bulk
        // verbs for a selection and the coverage pill, and every one of them has to sit on one
        // line. `w-3/4` still applies below this cap, so a narrow viewport is unaffected.
        <SideSheet
            isOpen={isOpen}
            onClose={onSheetClose}
            renderTitle={renderTitle}
            styles="max-w-[720px] sm:max-w-[720px]"
        >
            {renderBody()}
        </SideSheet>
    );
};

export default AccessGapSheet;
