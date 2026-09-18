import { CircleAlertIcon, Plug, PowerIcon, RotateCwIcon, TriangleAlertIcon, ZapIcon } from 'lucide-react';
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';

import { Spinner } from '@/components/ui/spinner';
import { trackEvent } from '@/lib/analytics';
import { cn } from '@/lib/utils';
import type { McpType } from '@/types/admin';

import type { DisabledAgentSkill } from '../../types';

import CapabilityOverflowButton from './components/capability-overflow-button';
import CapabilityRowLabel from './components/capability-row-label';
import NoAccessRow from './components/no-access-row';
import RecommendedOverflowDialog from './components/recommended-overflow-dialog';
import RowDismissButton from './components/row-dismiss-button';
import {
    CHIP_ACCENT_CLASSES,
    CHIP_GEOMETRY_CLASSES,
    CHIP_ICON_CLASSES,
    CHIP_NAME_CLASSES,
    CHIP_SURFACE_CLASSES,
    FOCUS_RING_CLASSES,
    MEASUREMENT_ROW_CLASSES,
    ROW_CLASSES,
    ROW_CONTENT_CLASSES,
    ROW_FIRST_CLASS,
} from './constants';
import type { CapabilityChip, ChipStatus } from './types';
import { useCapabilityOverflow } from './use-capability-overflow';
import { useEnableAllSkills } from './use-enable-all-skills';
import type { BannerDismissals, BannerRowKey } from './utils/banner-dismissal-storage';
import {
    getDismissalFingerprint,
    hasUndismissedEntry,
    pruneDismissalFingerprint,
    readBannerDismissals,
    writeBannerDismissal,
} from './utils/banner-dismissal-storage';
import { getCapabilityChips } from './utils/get-capability-chips';
import { getChipLabel } from './utils/get-chip-label';
import type { CapabilitySources } from './utils/get-no-access-capabilities';
import { getNoAccessCapabilities } from './utils/get-no-access-capabilities';
import {
    getRecommendationDismissalEvent,
    RECOMMENDATION_DISMISSED_EVENT,
} from './utils/get-recommendation-dismissal-event';

interface Props {
    /** Scopes a dismissal: it follows the agent, not the conversation. */
    agentId: string;
    /** The agent's attached connectors, straight from the agent payload. */
    mcpServers: McpType[];
    disabledMap: Record<string, boolean>;
    connectingId: string | null;
    enablingId: string | null;
    /** Starts the OAuth flow; resolves `false` when the authorization URL could not be obtained. */
    onConnect: (mcpServerId: string) => Promise<boolean>;
    /** Turns the connector on for this chat; resolves `false` when the preference could not be saved. */
    onEnable: (mcpServerId: string) => Promise<boolean>;
    disabledSkills: DisabledAgentSkill[];
    onEnableSkill: (skillId: string) => Promise<boolean>;
    /** The agent's capability collections, read only for the items flagged `noAccess`. */
    capabilities?: CapabilitySources;
}

const BANNER_TEXT = 'Recommended';
const BANNER_ACCESSIBLE_NAME = 'Recommended connectors and skills';
const BANNER_HINT = 'This agent uses these. Turn them on to use them in this chat.';
const DISMISS_LABEL = 'Dismiss recommendations';

// Same geometry and surface as the no-access chips; only the hue says these are actionable.
const CHIP_BASE_CLASSES = cn(
    CHIP_GEOMETRY_CLASSES,
    CHIP_SURFACE_CLASSES,
    'group cursor-pointer transition-colors disabled:cursor-default disabled:opacity-70',
    FOCUS_RING_CLASSES,
);

const CHIP_ERROR_CLASSES = [
    'text-destructive border-[color-mix(in_srgb,var(--destructive)_28%,transparent)]',
    'hover:bg-[color-mix(in_srgb,var(--destructive)_8%,var(--card))]',
].join(' ');

const RecommendedCapabilitiesBanner = ({
    agentId,
    mcpServers,
    disabledMap,
    connectingId,
    enablingId,
    onConnect,
    onEnable,
    disabledSkills,
    onEnableSkill,
    capabilities,
}: Props) => {
    const [isOverflowModalOpen, setIsOverflowModalOpen] = useState(false);
    const [failedKeys, setFailedKeys] = useState<string[]>([]);
    const [pendingSkillKeys, setPendingSkillKeys] = useState<string[]>([]);
    const [dismissals, setDismissals] = useState<BannerDismissals>(() => readBannerDismissals(agentId));
    const [dismissalsAgentId, setDismissalsAgentId] = useState(agentId);
    const previousEntriesRef = useRef<Record<BannerRowKey, readonly string[]> | null>(null);

    const chips = useMemo<CapabilityChip[]>(
        () => getCapabilityChips(mcpServers, disabledMap, disabledSkills),
        [mcpServers, disabledMap, disabledSkills],
    );

    const noAccessItems = useMemo(() => getNoAccessCapabilities(capabilities ?? {}), [capabilities]);

    const { measureRef, visibleCount } = useCapabilityOverflow(chips);

    useEffect(() => {
        if (chips.length === 0) setIsOverflowModalOpen(false);
    }, [chips.length]);

    // A chip carries its action, so a connector that went from "enable" to "reconnect" is a
    // blocker the viewer has never dismissed and must show again under its own entry.
    const chipEntries = useMemo(() => chips.map((chip) => `${chip.key}:${chip.action}`), [chips]);
    const noAccessEntries = useMemo(() => noAccessItems.map((item) => item._id), [noAccessItems]);

    // A dismissal is stored per agent, and the composer stays mounted across an agent switch.
    useLayoutEffect(() => {
        if (dismissalsAgentId === agentId) return;

        previousEntriesRef.current = null;
        setDismissalsAgentId(agentId);
        setDismissals(readBannerDismissals(agentId));
    }, [agentId, dismissalsAgentId]);

    // An entry that leaves a row loses its dismissal, so the same blocker arriving again is
    // read as unseen instead of staying silently dismissed for the rest of the session.
    useEffect(() => {
        if (dismissalsAgentId !== agentId) return;

        const previous = previousEntriesRef.current;

        previousEntriesRef.current = { recommended: chipEntries, noAccess: noAccessEntries };

        if (previous === null) return;

        const pruneRow = (row: BannerRowKey, entries: readonly string[]): string | null => {
            const dismissed = dismissals[row];

            if (dismissed === null) return null;

            const pruned = pruneDismissalFingerprint(dismissed, previous[row], entries);

            if (pruned !== dismissed) writeBannerDismissal(agentId, row, pruned);

            return pruned;
        };

        const recommended = pruneRow('recommended', chipEntries);
        const noAccess = pruneRow('noAccess', noAccessEntries);

        if (recommended === dismissals.recommended && noAccess === dismissals.noAccess) return;

        setDismissals({ recommended, noAccess });
    }, [agentId, dismissalsAgentId, dismissals, chipEntries, noAccessEntries]);

    // A chip that has left the row cannot be retried, so its failure must not outlive it and
    // paint the chip red the next time the same capability comes back.
    useEffect(() => {
        setFailedKeys((previous) => {
            const current = new Set(chips.map((chip) => chip.key));
            const kept = previous.filter((key) => current.has(key));

            return kept.length === previous.length ? previous : kept;
        });
    }, [chips]);

    const dismissRow = useCallback(
        (row: BannerRowKey, entries: readonly string[]) => {
            if (row === 'recommended') {
                setIsOverflowModalOpen(false);

                // Click-only path: a recommendation going stale is pruned by the effect above,
                // which writes storage directly and so must not be read as a viewer rejection.
                trackEvent(RECOMMENDATION_DISMISSED_EVENT, getRecommendationDismissalEvent(agentId, chips));
            }

            const fingerprint = getDismissalFingerprint(entries);

            writeBannerDismissal(agentId, row, fingerprint);
            setDismissals((previous) => ({ ...previous, [row]: fingerprint }));
        },
        [agentId, chips],
    );

    const markFailed = useCallback((keys: string[]) => {
        setFailedKeys((previous) => [...new Set([...previous, ...keys])]);
    }, []);

    const { isEnablingAll, enablingSkillKey, enableAllSkills } = useEnableAllSkills(onEnableSkill, markFailed);

    const handleAction = useCallback(
        async (chip: CapabilityChip) => {
            // A connector's pending state is owned by the caller; a skill write has no such
            // signal, so the in-flight key is tracked here to keep the chip from firing twice.
            if (chip.kind === 'skill') {
                // A bulk run writes the same skills through this path; a second writer would make
                // the earlier write lose the race and report a success as a failure.
                if (isEnablingAll || pendingSkillKeys.includes(chip.key)) return;

                setPendingSkillKeys((previous) => [...previous, chip.key]);
            }

            setFailedKeys((previous) => previous.filter((key) => key !== chip.key));

            const runAction = async () => {
                try {
                    if (chip.kind === 'skill') return await onEnableSkill(chip._id);

                    return chip.action === 'enable' ? await onEnable(chip._id) : await onConnect(chip._id);
                } finally {
                    if (chip.kind === 'skill')
                        setPendingSkillKeys((previous) => previous.filter((key) => key !== chip.key));
                }
            };

            if (!(await runAction())) {
                setFailedKeys((previous) => (previous.includes(chip.key) ? previous : [...previous, chip.key]));

                return;
            }

            if (chip.kind === 'skill' || chip.action === 'enable') {
                toast.success(`${chip.name} enabled for this chat`);
            }
        },
        [isEnablingAll, onConnect, onEnable, onEnableSkill, pendingSkillKeys],
    );

    const hasActionRow = chips.length > 0 && hasUndismissedEntry(dismissals.recommended, chipEntries);
    const hasNoAccessRow = noAccessItems.length > 0 && hasUndismissedEntry(dismissals.noAccess, noAccessEntries);

    if (!hasActionRow && !hasNoAccessRow) return null;

    const getChipStatus = (chip: CapabilityChip): ChipStatus => {
        const isPending =
            chip.kind === 'connector'
                ? connectingId === chip._id || enablingId === chip._id
                : pendingSkillKeys.includes(chip.key) || enablingSkillKey === chip.key;

        if (isPending) return 'pending';

        return failedKeys.includes(chip.key) ? 'error' : 'idle';
    };

    const renderChipIcon = (chip: CapabilityChip, status: ChipStatus) => {
        if (status === 'pending') return <Spinner className="size-3.5 shrink-0" />;
        if (status === 'error') return <CircleAlertIcon className="size-3.5 shrink-0" />;
        const iconClassName = cn(CHIP_ICON_CLASSES, 'transition-opacity group-hover:opacity-100');

        if (chip.kind === 'skill') return <ZapIcon className={iconClassName} />;
        if (chip.action === 'reconnect') return <RotateCwIcon className={iconClassName} />;
        if (chip.action === 'enable') return <PowerIcon className={iconClassName} />;

        return <Plug className={iconClassName} />;
    };

    const renderChip = (chip: CapabilityChip, options?: { isMeasurement?: boolean }) => {
        const isMeasurement = Boolean(options?.isMeasurement);
        const status = isMeasurement ? 'idle' : getChipStatus(chip);
        const label = getChipLabel(chip, status);
        const isDisabled = status === 'pending' || (isEnablingAll && chip.kind === 'skill');

        return (
            <button
                key={isMeasurement ? `measure-${chip.key}` : chip.key}
                type="button"
                aria-label={label}
                title={label}
                disabled={isDisabled}
                tabIndex={isMeasurement ? -1 : undefined}
                onClick={isMeasurement ? undefined : () => void handleAction(chip)}
                className={cn(CHIP_BASE_CLASSES, status === 'error' ? CHIP_ERROR_CLASSES : CHIP_ACCENT_CLASSES)}
            >
                {renderChipIcon(chip, status)}
                <span className={CHIP_NAME_CLASSES}>{label}</span>
            </button>
        );
    };

    const renderBannerLabel = (options?: { isMeasurement?: boolean }) => (
        <CapabilityRowLabel
            icon={TriangleAlertIcon}
            text={BANNER_TEXT}
            hint={BANNER_HINT}
            isMeasurement={options?.isMeasurement}
        />
    );

    const shownChips = chips.slice(0, visibleCount ?? chips.length);
    const hiddenCount = chips.length - shownChips.length;

    const renderActionRow = () => (
        <div className="recommended-capabilities-action relative">
            {/* Measured off-screen because the visible row is truncated to what fits; its
                padding and gap must stay identical to the visible row below. */}
            <div ref={measureRef} className={MEASUREMENT_ROW_CLASSES} aria-hidden>
                {renderBannerLabel({ isMeasurement: true })}
                {chips.map((chip) => renderChip(chip, { isMeasurement: true }))}
            </div>

            <div
                role="group"
                aria-label={BANNER_ACCESSIBLE_NAME}
                className={cn('recommended-capabilities-banner-row', ROW_CLASSES, !hasNoAccessRow && ROW_FIRST_CLASS)}
            >
                <div className={ROW_CONTENT_CLASSES}>
                    {renderBannerLabel()}
                    {shownChips.map((chip) => renderChip(chip))}
                    {hiddenCount > 0 && (
                        <CapabilityOverflowButton
                            hiddenCount={hiddenCount}
                            rowAccessibleName={BANNER_ACCESSIBLE_NAME}
                            onClick={() => setIsOverflowModalOpen(true)}
                        />
                    )}
                </div>
                <RowDismissButton label={DISMISS_LABEL} onDismiss={() => dismissRow('recommended', chipEntries)} />
            </div>

            <RecommendedOverflowDialog
                isOpen={isOverflowModalOpen}
                onOpenChange={setIsOverflowModalOpen}
                title={BANNER_ACCESSIBLE_NAME}
                description="Connect or switch these on to let this agent use them."
                chips={chips}
                getChipStatus={getChipStatus}
                onAction={(chip) => void handleAction(chip)}
                isEnablingAll={isEnablingAll}
                onEnableAllSkills={(skills) => void enableAllSkills(skills)}
            />
        </div>
    );

    return (
        <div className="recommended-capabilities-banner">
            {hasNoAccessRow && (
                <NoAccessRow
                    items={noAccessItems}
                    isFirstRow
                    onDismiss={() => dismissRow('noAccess', noAccessEntries)}
                />
            )}

            {hasActionRow && renderActionRow()}
        </div>
    );
};

export default RecommendedCapabilitiesBanner;
