import { Plug, TriangleAlertIcon } from 'lucide-react';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';

import { CONNECTORS_PATH } from '@/app/components/routine-runs';
import CapabilityRowLabel from '@/components/agent-chat/view/recommended-capabilities-banner/components/capability-row-label';
import RowDismissButton from '@/components/agent-chat/view/recommended-capabilities-banner/components/row-dismiss-button';
/**
 * Imported from the composer banner's own leaf modules rather than copied, so a restyle of the chat
 * chips moves this row with it. Deliberately NOT its barrel: that re-exports the banner itself, and
 * with it a data layer that derives health client-side - the one thing this row must not do.
 */
import {
    CHIP_ACCENT_CLASSES,
    CHIP_GEOMETRY_CLASSES,
    CHIP_ICON_CLASSES,
    CHIP_NAME_CLASSES,
    CHIP_SURFACE_CLASSES,
    FOCUS_RING_CLASSES,
    ROW_CONTENT_CLASSES,
} from '@/components/agent-chat/view/recommended-capabilities-banner/constants';
import { useRoutineConnectorHealthQuery } from '@/lib/api/app/routines';
import { cn } from '@/lib/utils';
import type { RoutineConnector } from '@/types/routines';

interface Props {
    /** The agent's ObjectId, never its slug: the endpoint rejects a slug with a 400. */
    agentId: string;
}

const LABEL_TEXT = 'Needs reconnecting';

/**
 * The consequence lives here rather than in the row: the endpoint is scoped to the AGENT and lists
 * every connector attached to it, not the ones this routine's instructions reach, so it can say a
 * run needing one will fail but never that this routine needs any particular one.
 */
const LABEL_HINT =
    'These were connected and have stopped working. A run that needs one will fail. Reconnecting is not required to save the routine, and this list covers every connector on the agent, not only the ones these instructions use.';

const DISMISS_LABEL = 'Dismiss the connectors needing a reconnect';

const CHIP_CLASSES = cn(CHIP_GEOMETRY_CLASSES, CHIP_SURFACE_CLASSES, CHIP_ACCENT_CLASSES, FOCUS_RING_CLASSES);

const ConnectorHealthBanner = ({ agentId }: Props) => {
    const { data, isPending, isError } = useRoutineConnectorHealthQuery(agentId);
    // Not persisted, unlike the composer banner's per-agent dismissal: a form is not a surface
    // someone returns to often enough for that to save them a click, and a warning that stays
    // dismissed across sessions is a way to ship a routine that cannot run without being told twice.
    const [isDismissed, setIsDismissed] = useState(false);
    /**
     * `needs_reconnect` only, never `not_connected`. A never-connected connector is the ordinary
     * resting state of most of an agent's list - dozens on a real account - and warning about those
     * would bury the one that actually broke. The api gates its own 424 on exactly this subset.
     */
    const blocked = useMemo<RoutineConnector[]>(
        () => (data ?? []).filter((connector) => connector.health === 'needs_reconnect'),
        [data],
    );

    // Silent while loading and on error: a routine the owner cannot save is worse than a warning
    // they do not get, and the run itself still refuses with a 424.
    if (isPending || isError || isDismissed || blocked.length === 0) return null;

    const renderChip = (connector: RoutineConnector) => {
        // "Reconnect", because only `needs_reconnect` reaches here: a connector that was working and
        // broke. The api separates that from `not_connected` precisely so the verb can be right -
        // telling someone to reconnect something they never connected sends them to redo nothing.
        const label = `Reconnect ${connector.name}`;
        // A `/`, `?` or `#` in the id would build a path matching no route, which lands the owner on
        // a blank pane rather than an error. The list is the honest fallback.
        const to = /[/?#]/.test(connector._id)
            ? CONNECTORS_PATH
            : `${CONNECTORS_PATH}/${encodeURIComponent(connector._id)}`;

        return (
            <Link
                key={connector._id}
                to={to}
                // A new tab, never in place: this row sits inside the routine dialog, which has no
                // unsaved-changes guard, so navigating would throw away a half-written routine.
                // It also means the chip has no pending or error state - nothing happens in this tab.
                target="_blank"
                rel="noreferrer"
                aria-label={label}
                title={label}
                className={CHIP_CLASSES}
            >
                <Plug aria-hidden="true" className={CHIP_ICON_CLASSES} />
                <span className={CHIP_NAME_CLASSES}>{label}</span>
            </Link>
        );
    };

    return (
        <div
            role="group"
            aria-label={LABEL_TEXT}
            // `items-start`, not `items-center`: the dismiss slot must stay on the first line when the
            // chips wrap, and a centred one would drift to the middle of the whole block.
            className={cn(
                'connector-health-banner flex items-start gap-2 border-b border-border px-3 py-2',
                // Matches the prompt card's own `rounded-xl`: it is the card's first row, and the
                // parent does not clip, so a square-cornered tint would poke out of both top corners.
                'rounded-t-xl',
                // The same faint wash `home-shared.scss` gives the composer banner's rows, so the bar
                // reads as its own row of the card rather than blending into the editor beneath it.
                'bg-[color-mix(in_srgb,var(--primary)_5%,var(--card))]',
            )}
        >
            {/*
             * The composer banner's own two-level shape, kept rather than flattened: label and chips
             * share this box so the dismiss button beside it can never be carried off by them. Only
             * the wrap differs - the composer bar clips instead, because a second line would push the
             * composer down, while a dialog scrolls and has the room, and the "+N" alternative is an
             * overflow dialog stacked on this one, which is a focus trap.
             */}
            <div className={cn(ROW_CONTENT_CLASSES, 'flex-wrap')}>
                <CapabilityRowLabel icon={TriangleAlertIcon} text={LABEL_TEXT} hint={LABEL_HINT} />
                {blocked.map(renderChip)}
            </div>
            {/* A chip's height, so the button centres on the FIRST chip line rather than 2px above it. */}
            <span className="flex h-7 shrink-0 items-center">
                <RowDismissButton label={DISMISS_LABEL} onDismiss={() => setIsDismissed(true)} />
            </span>
        </div>
    );
};

export default ConnectorHealthBanner;
