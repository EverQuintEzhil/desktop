import { AlarmClockIcon, HandIcon, PlayIcon, Trash2Icon, ZapIcon } from 'lucide-react';

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Select, { type ComboboxOption } from '@/components/ui/select';
import { EVENT_TRIGGER_COOLDOWN_DEFAULT_SECONDS } from '@/types/routines';
import { formatRelativeTime } from '@/utils/date';

import { nextTriggerFire } from '../utils/next-trigger-fire';
import { timezoneLabel } from '../utils/timezone-label';
import type { TriggerFormValue, TriggerKind } from '../utils/triggers';
import { canArmTrigger, isTriggerReadOnly, readOnlyTriggerSummary } from '../utils/triggers';

import ScheduleRow, { scheduleNote } from './schedule-row';
import { CHIP_CLASS, CHIP_JOINER_CLASS } from './trigger-chip';

export interface Props {
    value: TriggerFormValue;
    eventSourceOptions: ComboboxOption<string>[];
    cooldownOptions: ComboboxOption<string>[];
    canRemove: boolean;
    /** One trigger is presented as the routine's schedule, without the per-trigger pause/remove chrome. */
    error?: string;
    onChange: (value: TriggerFormValue) => void;
    onRemove: () => void;
}

const READ_ONLY_REASONS: Record<'legacy' | 'event' | 'unreadable', string> = {
    legacy: 'This schedule was set up before triggers existed, so it cannot be edited, paused, or removed here. Add another trigger to replace it.',
    event: 'Event triggers are set up outside this form, so this one is shown as it is.',
    unreadable: 'This trigger was set up outside this form and cannot be read here, so it is left as it is.',
};

const KIND_ICONS: Record<TriggerKind, typeof AlarmClockIcon> = {
    schedule: AlarmClockIcon,
    event: ZapIcon,
    manual: HandIcon,
};

const ACTION_CLASS = 'size-7 shrink-0 rounded-full text-(--text-secondary) hover:bg-accent hover:text-(--text-primary)';

const TriggerRow = ({ value, eventSourceOptions, cooldownOptions, canRemove, error, onChange, onRemove }: Props) => {
    const isReadOnly = isTriggerReadOnly(value);
    const isPaused = value.status === 'paused';
    const KindIcon = KIND_ICONS[value.kind];

    // `spent` is where the api parks a one-shot that already fired; touching it is a request to re-arm it.
    // The stored clock only excuses re-saving a past date nobody touched, so any schedule edit drops it.
    const patch = (next: Partial<TriggerFormValue>) => {
        if (value.status === 'spent') {
            onChange({ ...value, ...next, status: 'active', storedRunAt: null });

            return;
        }

        onChange(next.schedule ? { ...value, ...next, storedRunAt: null } : { ...value, ...next });
    };

    const renderBadges = () => (
        <>
            {isPaused ? <Badge variant="outline">Paused</Badge> : null}
            {value.status === 'spent' ? <Badge variant="outline">Already ran</Badge> : null}
            {value.synced ? null : (
                <Badge variant="outline" className="border-destructive/30 text-destructive">
                    Not scheduled yet
                </Badge>
            )}
            {value.legacy ? <Badge variant="outline">Legacy</Badge> : null}
        </>
    );

    // Kinds are chosen in the Add menu, not on the row, so an editable row leads with its own controls.
    const renderKind = () => {
        if (isReadOnly) return <span className="text-sm text-(--text-primary)">{readOnlyTriggerSummary(value)}</span>;
        if (value.kind === 'manual') return <span className="text-sm text-(--text-primary)">Only when you run it</span>;

        return null;
    };

    // The api describes only which sources exist, never which fields they can be filtered on, so there is
    // a source and a cooldown here and no filter editor.
    const renderEventControls = () => (
        <>
            <Select<string>
                options={eventSourceOptions}
                value={value.eventSource}
                onChange={(next) => patch({ eventSource: next })}
                ariaLabel="Event source"
                placeholder="Pick an event..."
                variant="ghost"
                className={CHIP_CLASS}
                isErrored={Boolean(error)}
                modal
            />
            <span className={CHIP_JOINER_CLASS}>at most once every</span>
            <Select<string>
                options={cooldownOptions}
                value={String(value.cooldownSeconds)}
                onChange={(next) => patch({ cooldownSeconds: Number(next ?? EVENT_TRIGGER_COOLDOWN_DEFAULT_SECONDS) })}
                ariaLabel="Cooldown"
                variant="ghost"
                className={CHIP_CLASS}
                modal
            />
        </>
    );

    const renderControls = () => {
        if (isReadOnly || value.kind === 'manual') return null;
        if (value.kind === 'event') return renderEventControls();

        return (
            <ScheduleRow
                value={value.schedule}
                onChange={(schedule) => patch({ schedule })}
                customCron={value.customCron}
                isErrored={Boolean(error)}
                timezone={value.timezone}
            />
        );
    };

    const renderTimezone = () => {
        if (isReadOnly || value.kind !== 'schedule') return null;

        return (
            <span title={value.timezone} className="ml-auto pl-1 text-xs text-(--text-secondary)">
                {timezoneLabel(value.timezone)}
            </span>
        );
    };

    // Pausing lives on the routine, so an active row offers no pause — but a row stored as paused still needs a way back.
    const renderResumeButton = () => {
        if (isReadOnly || value.status === 'spent' || !isPaused) return null;
        if (!canArmTrigger(value, new Date())) return null;

        return (
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={ACTION_CLASS}
                aria-label="Resume trigger"
                onClick={() => onChange({ ...value, status: 'active' })}
            >
                <PlayIcon aria-hidden="true" />
            </Button>
        );
    };

    const renderRemoveButton = () => {
        if (isReadOnly) return null;

        return (
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className={`${ACTION_CLASS} hover:bg-destructive/10 hover:text-destructive`}
                aria-label="Remove trigger"
                disabled={!canRemove}
                onClick={onRemove}
            >
                <Trash2Icon aria-hidden="true" className="size-4" />
            </Button>
        );
    };

    const renderNextRunPreview = () => {
        // A paused trigger has no next run, so a preview under its Paused badge would contradict it.
        if (isReadOnly || value.kind !== 'schedule' || value.status === 'spent' || isPaused) return null;
        // Same reason: an unconfirmed schedule already says it will not fire, so it must not also promise a time.
        if (!value.synced) return null;

        const next = nextTriggerFire(value);

        if (!next) return null;

        // The routine's own zone, same as the tag beside the controls — the browser's zone may disagree.
        const absolute = next.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone: value.timezone,
        });

        return (
            <p className="px-1 text-xs text-(--text-secondary)">
                {`Next run: ${absolute} (in ${formatRelativeTime(next, false)})`}
            </p>
        );
    };

    const renderNotes = () => {
        const notes: string[] = [];

        if (isReadOnly) notes.push(READ_ONLY_REASONS[value.readOnlyReason ?? 'event']);
        if (value.kind === 'schedule' && !isReadOnly) {
            const note = scheduleNote(value.schedule);

            if (note) notes.push(note);
        }
        if (!value.synced) {
            notes.push(
                'The scheduler has not confirmed this schedule, so it will not fire yet. Save the routine again, and tell us if it stays this way.',
            );
        }

        if (notes.length === 0) return null;

        return notes.map((note) => (
            <p key={note} className="px-1 text-xs text-(--text-secondary)">
                {note}
            </p>
        ));
    };

    return (
        <div className="trigger-row flex flex-col gap-1.5">
            <div className="trigger-row-box flex flex-wrap items-center gap-2 rounded-xl border border-dashed border-border-secondary px-2 py-2">
                <span
                    aria-hidden="true"
                    className="trigger-row-icon flex size-8 shrink-0 items-center justify-center rounded-full bg-primary/10"
                >
                    <KindIcon className="size-4 text-primary" />
                </span>
                {renderKind()}
                {renderControls()}
                {renderBadges()}
                {renderTimezone()}
                <div className="trigger-row-actions ml-auto flex items-center gap-0.5">
                    {renderResumeButton()}
                    {renderRemoveButton()}
                </div>
            </div>
            {error ? <span className="px-1 text-xs text-destructive">{error}</span> : null}
            {renderNextRunPreview()}
            {renderNotes()}
        </div>
    );
};

export default TriggerRow;
