import { LockIcon } from 'lucide-react';
import { useMemo, useState } from 'react';

import { cn } from '@/lib/utils';

import {
    CAPABILITY_ICON_BY_KIND,
    CHIP_GEOMETRY_CLASSES,
    CHIP_ICON_CLASSES,
    CHIP_MUTED_CLASSES,
    CHIP_NAME_CLASSES,
    CHIP_SURFACE_CLASSES,
    MEASUREMENT_ROW_CLASSES,
    ROW_CLASSES,
    ROW_CONTENT_CLASSES,
    ROW_FIRST_CLASS,
} from '../constants';
import type { NoAccessCapability } from '../types';
import { useCapabilityOverflow } from '../use-capability-overflow';
import { groupCapabilitiesByKind } from '../utils/group-capabilities-by-kind';

import CapabilityOverflowButton from './capability-overflow-button';
import CapabilityOverflowDialog from './capability-overflow-dialog';
import CapabilityRowLabel from './capability-row-label';
import CapabilitySectionList from './capability-section-list';
import RowDismissButton from './row-dismiss-button';

interface Props {
    items: NoAccessCapability[];
    /** Set by the banner when this row is the visually topmost one, so it rounds its top corners. */
    isFirstRow?: boolean;
    onDismiss: () => void;
}

const ROW_TEXT = 'No access';
const ROW_ACCESSIBLE_NAME = 'Capabilities you have no access to';
const ROW_HINT = 'No access — ask an admin to grant it.';
const DISMISS_LABEL = 'Dismiss no access';

// Same geometry and surface as the actionable chips; only the hue says these are inert.
const CHIP_CLASSES = cn(CHIP_GEOMETRY_CLASSES, CHIP_SURFACE_CLASSES, CHIP_MUTED_CLASSES, 'select-none');

const NoAccessRow = ({ items, isFirstRow = false, onDismiss }: Props) => {
    const [isOverflowModalOpen, setIsOverflowModalOpen] = useState(false);
    const { measureRef, visibleCount } = useCapabilityOverflow(items);

    const sections = useMemo(
        () =>
            groupCapabilitiesByKind(items).map((section) => ({
                ...section,
                items: section.items.map((item) => ({
                    key: item.key,
                    name: item.name,
                    icon: CAPABILITY_ICON_BY_KIND[item.kind],
                })),
            })),
        [items],
    );

    const renderChipIcon = (item: NoAccessCapability) => {
        const Icon = CAPABILITY_ICON_BY_KIND[item.kind];

        return <Icon className={CHIP_ICON_CLASSES} aria-hidden />;
    };

    const renderChip = (item: NoAccessCapability, options?: { isMeasurement?: boolean }) => (
        <span
            key={options?.isMeasurement ? `measure-${item.key}` : item.key}
            title={`${item.name} — ${ROW_HINT}`}
            className={CHIP_CLASSES}
        >
            {renderChipIcon(item)}
            <span className={CHIP_NAME_CLASSES}>{item.name}</span>
        </span>
    );

    const renderRowLabel = (options?: { isMeasurement?: boolean }) => (
        <CapabilityRowLabel icon={LockIcon} text={ROW_TEXT} hint={ROW_HINT} isMeasurement={options?.isMeasurement} />
    );

    const shownItems = items.slice(0, visibleCount ?? items.length);
    const hiddenCount = items.length - shownItems.length;

    return (
        <div className="recommended-capabilities-no-access relative">
            {/* Measured off-screen because the visible row is truncated to what fits; its
                padding and gap must stay identical to the visible row below. */}
            <div ref={measureRef} className={MEASUREMENT_ROW_CLASSES} aria-hidden>
                {renderRowLabel({ isMeasurement: true })}
                {items.map((item) => renderChip(item, { isMeasurement: true }))}
            </div>

            <div
                role="group"
                aria-label={ROW_ACCESSIBLE_NAME}
                className={cn('recommended-capabilities-no-access-row', ROW_CLASSES, isFirstRow && ROW_FIRST_CLASS)}
            >
                <div className={ROW_CONTENT_CLASSES}>
                    {renderRowLabel()}
                    {shownItems.map((item) => renderChip(item))}
                    {hiddenCount > 0 && (
                        <CapabilityOverflowButton
                            hiddenCount={hiddenCount}
                            rowAccessibleName={ROW_ACCESSIBLE_NAME}
                            onClick={() => setIsOverflowModalOpen(true)}
                        />
                    )}
                </div>
                <RowDismissButton label={DISMISS_LABEL} onDismiss={onDismiss} />
            </div>

            <CapabilityOverflowDialog
                isOpen={isOverflowModalOpen}
                onOpenChange={setIsOverflowModalOpen}
                title={ROW_ACCESSIBLE_NAME}
                description={ROW_HINT}
            >
                <CapabilitySectionList sections={sections} />
            </CapabilityOverflowDialog>
        </div>
    );
};

export default NoAccessRow;
