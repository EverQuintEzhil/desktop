import { Button } from '@/components/ui/button';
import { Spinner } from '@/components/ui/spinner';

import { CAPABILITY_ICON_BY_KIND } from '../constants';
import type { CapabilityChip, ChipStatus } from '../types';
import { getChipLabel, IDLE_LABELS } from '../utils/get-chip-label';
import { groupCapabilitiesByKind } from '../utils/group-capabilities-by-kind';

import CapabilityOverflowDialog from './capability-overflow-dialog';
import CapabilitySectionList from './capability-section-list';
import type { CapabilitySectionListItems } from './capability-section-list';

interface Props {
    isOpen: boolean;
    onOpenChange: (isOpen: boolean) => void;
    title: string;
    description: string;
    chips: CapabilityChip[];
    getChipStatus: (chip: CapabilityChip) => ChipStatus;
    onAction: (chip: CapabilityChip) => void;
    isEnablingAll: boolean;
    /** Bulk-enables the skills section only: each connector needs its own OAuth redirect. */
    onEnableAllSkills: (skills: CapabilityChip[]) => void;
}

const RecommendedOverflowDialog = ({
    isOpen,
    onOpenChange,
    title,
    description,
    chips,
    getChipStatus,
    onAction,
    isEnablingAll,
    onEnableAllSkills,
}: Props) => {
    const renderChipAction = (chip: CapabilityChip) => {
        const status = getChipStatus(chip);
        const label = getChipLabel(chip, status);

        return (
            <Button
                size="sm"
                variant={status === 'error' ? 'destructive' : 'outline'}
                className="min-w-[88px] shrink-0 justify-center"
                disabled={status === 'pending' || (isEnablingAll && chip.kind === 'skill')}
                aria-label={label}
                onClick={() => onAction(chip)}
            >
                {status === 'pending' ? <Spinner className="size-3.5" /> : null}
                {status === 'error' ? 'Retry' : IDLE_LABELS[chip.action]}
            </Button>
        );
    };

    const renderEnableAllSkills = (skills: CapabilityChip[]) => (
        <Button
            size="sm"
            variant="ghost"
            className="h-6 shrink-0 px-2 text-xs"
            disabled={isEnablingAll}
            aria-label="Enable all skills"
            onClick={() => onEnableAllSkills(skills)}
        >
            {isEnablingAll ? <Spinner className="size-3" /> : null}
            {isEnablingAll ? 'Enabling all' : 'Enable all'}
        </Button>
    );

    const sections: CapabilitySectionListItems[] = groupCapabilitiesByKind(chips).map((section) => ({
        kind: section.kind,
        label: section.label,
        headerAction: section.kind === 'skill' ? renderEnableAllSkills(section.items) : undefined,
        items: section.items.map((chip) => ({
            key: chip.key,
            name: chip.name,
            icon: CAPABILITY_ICON_BY_KIND[chip.kind],
            action: renderChipAction(chip),
        })),
    }));

    return (
        <CapabilityOverflowDialog isOpen={isOpen} onOpenChange={onOpenChange} title={title} description={description}>
            <CapabilitySectionList sections={sections} />
        </CapabilityOverflowDialog>
    );
};

export default RecommendedOverflowDialog;
