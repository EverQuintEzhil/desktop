import type { CapabilityChip } from '../types';

export const RECOMMENDATION_DISMISSED_EVENT = 'recommendation_dismissed';

type RecommendationSurface = 'chat_composer';

interface DismissedItem {
    recommendation_type: string;
    capability_id: string;
    name: string;
}

/** A type alias, not an interface, so the payload is assignable to the tracker's props map. */
export type RecommendationDismissalEvent = {
    surface: RecommendationSurface;
    agent_id: string;
    /** The one type on the row, or `mixed` when the viewer waved away several at once. */
    recommendation_type: string;
    /** Only set when the row held a single connector, so the common case breaks down directly. */
    connector_id: string | null;
    item_count: number;
    items: DismissedItem[];
};

/**
 * What a chip was asking for, and so what the viewer turned down: `reconnect_connector`,
 * `connect_connector`, `enable_connector` or `enable_skill`.
 */
export const getRecommendationType = (chip: CapabilityChip): string => `${chip.action}_${chip.kind}`;

/**
 * One event per dismiss click. The row is dismissed as a whole, so the payload names every
 * item it was carrying and keeps the flat `recommendation_type` / `connector_id` fields for
 * the single-item case that dominates.
 */
export const getRecommendationDismissalEvent = (
    agentId: string,
    chips: readonly CapabilityChip[],
): RecommendationDismissalEvent => {
    const items = chips.map<DismissedItem>((chip) => ({
        recommendation_type: getRecommendationType(chip),
        capability_id: chip._id,
        name: chip.name,
    }));

    const types = [...new Set(items.map((item) => item.recommendation_type))];
    const connectors = chips.filter((chip) => chip.kind === 'connector');

    return {
        surface: 'chat_composer',
        agent_id: agentId,
        recommendation_type: types.length === 1 ? types[0] : 'mixed',
        connector_id: chips.length === 1 && connectors.length === 1 ? connectors[0]._id : null,
        item_count: items.length,
        items,
    };
};
