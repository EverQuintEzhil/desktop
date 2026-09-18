import {
    ArchiveIcon,
    CalendarClockIcon,
    ClockIcon,
    ListFilterIcon,
    PauseIcon,
    PlusIcon,
    RotateCcwIcon,
    SearchIcon,
    SparklesIcon,
} from 'lucide-react';

import { Button } from '@/components/ui/button';

import type { RoutineStatusFilter } from '../constants';

import RoutinesEmptyState from './routines-empty-state';

interface Props {
    searchTerm: string;
    isArchivedView: boolean;
    statusFilter: RoutineStatusFilter;
    onCreate: () => void;
}

const STATUS_EMPTY_LABEL: Record<Exclude<RoutineStatusFilter, 'all'>, string> = {
    active: 'active',
    paused: 'paused',
};

const RoutinesListEmpty = ({ searchTerm, isArchivedView, statusFilter, onCreate }: Props) => {
    if (searchTerm) {
        return (
            <RoutinesEmptyState
                Icon={SearchIcon}
                title={isArchivedView ? 'No matching archived routines' : 'No matching routines'}
                description={
                    isArchivedView
                        ? `Nothing archived matches "${searchTerm}". Try a shorter search, or go back to your routines.`
                        : `Nothing matches "${searchTerm}". Try a shorter search, or look under View archived.`
                }
            />
        );
    }

    // Offering New routine here would create a routine the filter then hides, which reads as a failed save.
    if (statusFilter !== 'all' && !isArchivedView) {
        return (
            <RoutinesEmptyState
                Icon={ListFilterIcon}
                title={`No ${STATUS_EMPTY_LABEL[statusFilter]} routines`}
                description={`Nothing here is ${STATUS_EMPTY_LABEL[statusFilter]} right now. Switch the filter back to All statuses to see the rest.`}
            />
        );
    }

    if (isArchivedView) {
        return (
            <RoutinesEmptyState
                Icon={ArchiveIcon}
                title="Nothing archived"
                description="Archiving a routine stops it and keeps it here. Bring one back any time — it stays paused until you resume it."
                accents={[PauseIcon, RotateCcwIcon]}
                hints={['Stops running', 'Kept, not deleted', 'Restorable']}
            />
        );
    }

    return (
        <RoutinesEmptyState
            Icon={CalendarClockIcon}
            title="No routines yet"
            description="Add one from a template below, or create your own to run research on a schedule."
            accents={[SparklesIcon, ClockIcon]}
            action={
                <Button type="button" size="sm" className="rounded-full" onClick={onCreate}>
                    <PlusIcon aria-hidden="true" className="size-4" />
                    New routine
                </Button>
            }
            hints={['Daily or weekly', 'On an event', 'Emailed to you']}
        />
    );
};

export default RoutinesListEmpty;
