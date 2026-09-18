import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { RoutineEventSource } from '@/types/routines';

import { type TriggerSetLock, useRoutineTriggers } from '../hooks/use-routine-triggers';

import TriggersField from './triggers-field';

interface Props {
    triggerState: ReturnType<typeof useRoutineTriggers>;
    eventSources: RoutineEventSource[];
}

const TRIGGER_LOCK_NOTICES: Record<TriggerSetLock, string> = {
    unreadable:
        "This routine's triggers could not be loaded, so they cannot be changed here. Everything else on this form still saves.",
    unwritable:
        'This routine has a trigger this form cannot rewrite, so its triggers are left exactly as they are. Everything else on this form still saves.',
};

const RoutineTriggersSection = ({ triggerState, eventSources }: Props) => {
    if (triggerState.isLoading) {
        return (
            <div className="flex flex-col gap-1.5">
                <Label className="text-sm text-text-secondary">Triggers</Label>
                <Skeleton className="h-16 rounded-xl" />
            </div>
        );
    }

    if (triggerState.lock) {
        return (
            <div className="flex flex-col gap-1.5">
                <Label className="text-sm text-text-secondary">Triggers</Label>
                <p className="text-xs text-muted-foreground">{TRIGGER_LOCK_NOTICES[triggerState.lock]}</p>
            </div>
        );
    }

    return (
        <TriggersField values={triggerState.triggers} eventSources={eventSources} onChange={triggerState.setTriggers} />
    );
};

export default RoutineTriggersSection;
