import type { ReactNode } from 'react';

import type { AccessPrincipalKind, CapabilityKind } from '@/lib/api/admin/agent-access-check';

import type { CoveragePrincipal } from '../../../../../agent-access/access-coverage';
import type { ItemAccessState, PrincipalGap, PrincipalGapItem } from '../../use-agent-access-gaps';

/**
 * The person a write is about, in the little of them every step of it reads: which rows to repaint,
 * whose name an ignore entry carries, and — through `CoveragePrincipal` — whether a removal would
 * leave them covered anyway.
 */
export interface ActionPrincipal extends CoveragePrincipal {
    name: string;
}

/**
 * One capability and one principal: the unit every action is keyed by, on the ignore route as
 * well as on the two ACL lists. Both sheet shapes reduce a row to this before acting, so the
 * gating and the button set live in one place instead of once per view.
 */
export interface GapPair {
    itemId: string;
    itemName: string;
    itemKind: CapabilityKind;
    /** From the endpoint when it knows; absent means the UI falls back to its own role check. */
    canGrant?: boolean;
    /** False means an exclusion written here would be stored and ignored, so it is not offered. */
    excludable?: boolean;
    principal: ActionPrincipal;
    principalKind: AccessPrincipalKind;
    /** Decides which actions make sense: there is nothing to grant on a row that already has access. */
    state: ItemAccessState;
}

/** The row is rendered by the level that knows the person, so the view passes only its item. */
export type RenderRowActions = (item: PrincipalGapItem) => ReactNode;

/**
 * Multi-select over people rows for bulk granting. Only people with at least one grantable gap
 * are selectable; granting fixes their `missing` items and never overrides a deliberate
 * exclusion or a dismissal.
 */
export interface PeopleSelection {
    selectedIds: Set<string>;
    isSelectable: (person: PrincipalGap) => boolean;
    onToggle: (personId: string, selected: boolean) => void;
    onGrantSelected: () => void;
    /** The grant is on the wire: the bar says so and takes no second click. */
    isPending: boolean;
}
