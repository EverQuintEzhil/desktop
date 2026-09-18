import {
    CalendarClockIcon,
    CalendarDaysIcon,
    CalendarIcon,
    CalendarRangeIcon,
    ClockIcon,
    HandIcon,
    PlusIcon,
    TimerIcon,
    ZapIcon,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { useMemo } from 'react';

import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Label } from '@/components/ui/label';
import type { ComboboxOption } from '@/components/ui/select';
import { EVENT_TRIGGER_COOLDOWN_DEFAULT_SECONDS, type RoutineEventSource } from '@/types/routines';
import { getBrowserTimezone } from '@/utils/browser-timezone';

import { weekdaysSeed } from '../constants';
import type { ScheduleFrequency } from '../types';
import { onceScheduleSeed } from '../utils/cron-schedule';
import type { TriggerFormValue } from '../utils/triggers';
import {
    canRemoveTrigger,
    COOLDOWN_SECONDS_OPTIONS,
    createTriggerFormValue,
    formatCooldown,
    isManualPlaceholder,
    validateTrigger,
} from '../utils/triggers';

import TriggerRow from './trigger-row';

export interface Props {
    values: TriggerFormValue[];
    /** Empty until the api's event ingress flag is on, which is what hides the event trigger type. */
    eventSources: RoutineEventSource[];
    onChange: (values: TriggerFormValue[]) => void;
}

const COOLDOWN_OPTIONS: ComboboxOption<string>[] = COOLDOWN_SECONDS_OPTIONS.map((seconds) => ({
    value: String(seconds),
    label: formatCooldown(seconds),
}));

const SCHEDULE_CHOICES: { frequency: ScheduleFrequency; label: string; description: string; Icon: LucideIcon }[] = [
    { frequency: 'once', label: 'Once', description: 'On a chosen date and time', Icon: CalendarClockIcon },
    { frequency: 'hourly', label: 'Hourly', description: 'Every hour within chosen hours', Icon: TimerIcon },
    { frequency: 'daily', label: 'Daily', description: 'Every day at a chosen time', Icon: ClockIcon },
    { frequency: 'weekly', label: 'Weekly', description: 'Every week on a chosen day', Icon: CalendarDaysIcon },
    { frequency: 'monthly', label: 'Monthly', description: 'Every month on a chosen day', Icon: CalendarIcon },
    { frequency: 'yearly', label: 'Yearly', description: 'Every year on a chosen date', Icon: CalendarRangeIcon },
];

const TriggersField = ({ values, eventSources, onChange }: Props) => {
    const now = new Date();

    const eventSourceOptions = useMemo(
        () => eventSources.map((source) => ({ value: source.id, label: source.name })),
        [eventSources],
    );

    const replaceAt = (index: number, next: TriggerFormValue) =>
        onChange(values.map((value, at) => (at === index ? next : value)));

    // One trigger per routine for now: adding replaces the empty manual slot instead of stacking a second row.
    const withNewRow = (row: TriggerFormValue) => [...values.filter((value) => !isManualPlaceholder(value)), row];

    const addManual = () =>
        onChange(withNewRow({ ...createTriggerFormValue(getBrowserTimezone()), kind: 'manual', explicit: true }));

    const addSchedule = (frequency: ScheduleFrequency) => {
        const created = createTriggerFormValue(getBrowserTimezone());
        // Once seeds to the zone's next minute; the shared 9:00 default would be in the past every afternoon.
        const onceSeed = frequency === 'once' ? onceScheduleSeed(new Date(), created.timezone) : null;

        onChange(
            withNewRow({
                ...created,
                schedule: {
                    ...created.schedule,
                    frequency,
                    weekdays: weekdaysSeed(frequency),
                    ...(onceSeed ?? {}),
                },
            }),
        );
    };

    const addEvent = (sourceId: string) => {
        const created = createTriggerFormValue(getBrowserTimezone());

        onChange(
            withNewRow({
                ...created,
                kind: 'event',
                eventSource: sourceId,
                cooldownSeconds: EVENT_TRIGGER_COOLDOWN_DEFAULT_SECONDS,
            }),
        );
    };

    // The api rejects an empty trigger set, so clearing the last row swaps in a manual trigger.
    const removeAt = (index: number) => {
        const rest = values.filter((_, at) => at !== index);

        if (rest.length > 0) {
            onChange(rest);

            return;
        }

        onChange([{ ...createTriggerFormValue(getBrowserTimezone()), kind: 'manual' }]);
    };

    const renderAddTrigger = () => (
        <DropdownMenuRoot modal={false}>
            <DropdownMenuTrigger asChild>
                <button
                    type="button"
                    className="flex w-full cursor-pointer items-center gap-1.5 rounded-xl border border-dashed border-border-secondary px-3 py-2.5 text-sm text-text-secondary hover:border-primary hover:text-primary focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:outline-none"
                >
                    <PlusIcon aria-hidden="true" className="size-4" />
                    Add trigger
                </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-(--radix-dropdown-menu-trigger-width)">
                <DropdownMenuLabel className="text-xs text-text-secondary">General</DropdownMenuLabel>
                {SCHEDULE_CHOICES.map(({ frequency, label, description, Icon }) => (
                    <DropdownMenuItem
                        key={frequency}
                        className="cursor-pointer items-start gap-2.5"
                        onSelect={() => addSchedule(frequency)}
                    >
                        <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                            <Icon aria-hidden="true" className="size-3.5 text-primary" />
                        </span>
                        <span className="flex min-w-0 flex-col">
                            <span className="text-sm">{label}</span>
                            <span className="text-xs text-text-secondary">{description}</span>
                        </span>
                    </DropdownMenuItem>
                ))}
                <DropdownMenuItem className="cursor-pointer items-start gap-2.5" onSelect={addManual}>
                    <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                        <HandIcon aria-hidden="true" className="size-3.5 text-primary" />
                    </span>
                    <span className="flex min-w-0 flex-col">
                        <span className="text-sm">Manual</span>
                        <span className="text-xs text-text-secondary">Only when you run it</span>
                    </span>
                </DropdownMenuItem>
                {eventSources.length > 0 ? (
                    <>
                        <DropdownMenuLabel className="text-xs text-text-secondary">Events</DropdownMenuLabel>
                        {eventSources.map((source) => (
                            <DropdownMenuItem
                                key={source.id}
                                className="cursor-pointer items-start gap-2.5"
                                onSelect={() => addEvent(source.id)}
                            >
                                <span className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full bg-primary/10">
                                    <ZapIcon aria-hidden="true" className="size-3.5 text-primary" />
                                </span>
                                <span className="flex min-w-0 flex-col">
                                    <span className="text-sm">{source.name}</span>
                                    <span className="text-xs text-text-secondary">When this event fires</span>
                                </span>
                            </DropdownMenuItem>
                        ))}
                    </>
                ) : null}
            </DropdownMenuContent>
        </DropdownMenuRoot>
    );

    // The empty manual slot is the empty state, so it renders as the Add box below instead of a row.
    const renderRows = () =>
        values.map((value, index) => {
            if (isManualPlaceholder(value)) return null;

            return (
                <div key={value.key}>
                    <TriggerRow
                        value={value}
                        eventSourceOptions={eventSourceOptions}
                        cooldownOptions={COOLDOWN_OPTIONS}
                        canRemove={canRemoveTrigger(value)}
                        error={validateTrigger(value, now)}
                        onChange={(next) => replaceAt(index, next)}
                        onRemove={() => removeAt(index)}
                    />
                </div>
            );
        });

    return (
        <div className="triggers-field flex flex-col gap-1.5">
            <Label className="text-sm text-text-secondary">Triggers</Label>
            <div className="triggers-field-list flex flex-col gap-2">
                {renderRows()}
                {/* One trigger for now, so the menu is only offered while every slot is still empty. */}
                {values.every(isManualPlaceholder) ? renderAddTrigger() : null}
            </div>
        </div>
    );
};

export default TriggersField;
