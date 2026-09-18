import { useStore } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { Plug, PowerIcon, RotateCwIcon, TriangleAlertIcon, type LucideIcon } from 'lucide-react';
import { useCallback, useRef } from 'react';

import { Button } from '@/components/ui/button';
import { DialogBody, DialogFooter } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select, { type ComboboxOption } from '@/components/ui/select';
import { Spinner } from '@/components/ui/spinner';
import { useRoutineEventSourcesQuery } from '@/lib/api/app/routines';
import { cn } from '@/lib/utils';
import type { RoutineEventSource, RoutineType } from '@/types/routines';
import { getBrowserTimezone } from '@/utils/browser-timezone';

import { NAME_MAX_LENGTH, PROMPT_MAX_LENGTH } from '../constants';
import { type RoutinesUnavailableReason, useRoutineAgentState } from '../hooks/use-routine-agent-state';
import { useRoutineForm } from '../hooks/use-routine-form';
import { useRoutineTriggers } from '../hooks/use-routine-triggers';
import { loadChatAgentOptions } from '../utils/chat-agent-options';
import type { BlockingConnector } from '../utils/routine-agent-connectors';

import ConnectorHealthBanner from './connector-health-banner';
import RecipientsField from './recipients-field';
import RoutineIconPicker from './routine-icon-picker';
import RoutinePromptEditor from './routine-prompt-editor';
import RoutinePromptToolbar, { RoutineModelNotice } from './routine-prompt-toolbar';
import RoutineTriggersSection from './routine-triggers-section';

interface Props {
    /** Present = edit mode; absent = create mode. */
    routine?: RoutineType | null;
    /** Present = the page is scoped to this agent, so the routine belongs to it and the field is dropped. */
    agent?: { _id: string; name: string };
    /** Present = opened from a space, so that space is pre-selected. */
    project?: { _id: string; name: string };
    onClose: () => void;
}

const NAME_COUNTER_THRESHOLD = 40;

const PROMPT_COUNTER_THRESHOLD = 500;

const NO_EVENT_SOURCES: RoutineEventSource[] = [];

// Only reachable where the agent is fixed by the page or by the routine being edited: the picker
// offers no agent that cannot carry a routine.
const unavailableNotice = (agentName: string, reason: RoutinesUnavailableReason): string =>
    reason === 'not-chat'
        ? `${agentName} is not a chat agent, so it has no routines. Pick a chat agent instead.`
        : `${agentName} does not have routines turned on, so a routine cannot be created for it. Pick another agent, or ask an admin to turn routines on.`;

const renderRoutinesDisabledNotice = (agentName: string, reason: RoutinesUnavailableReason) => (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
        <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-destructive" />
        <span>{unavailableNotice(agentName, reason)}</span>
    </div>
);

// Worded and iconed as the chat composer's recommended-capabilities banner words them, so the
// same blocked connector does not read as a different thing on the two surfaces.
const CONNECTOR_ACTION_LABELS: Record<BlockingConnector['action'], string> = {
    connect: 'Connect',
    reconnect: 'Reconnect',
    enable: 'Enable',
};

const CONNECTOR_ACTION_ICONS: Record<BlockingConnector['action'], LucideIcon> = {
    connect: Plug,
    reconnect: RotateCwIcon,
    enable: PowerIcon,
};

const CONNECTOR_CHIP_CLASSES = cn(
    'flex h-7 shrink-0 cursor-pointer items-center gap-1.5 rounded-full whitespace-nowrap',
    'border border-primary/25 bg-card px-2.5 text-xs font-medium text-primary',
    'transition-colors hover:bg-primary/10 disabled:cursor-default disabled:opacity-70',
    'focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:outline-none',
);

const renderBlockingConnectorsNotice = (
    agentName: string,
    connectors: BlockingConnector[],
    connectingId: string | null,
    enablingId: string | null,
    onFix: (connector: BlockingConnector) => void,
) => (
    <div className="flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2.5">
        <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-destructive" />
        <div className="flex min-w-0 flex-1 flex-col gap-2">
            <span className="text-xs text-muted-foreground">
                {agentName} can&apos;t run a routine until{' '}
                {connectors.length > 1 ? 'these connectors are' : 'this connector is'} ready.
            </span>
            <div className="flex flex-wrap gap-1.5">
                {connectors.map((connector) => {
                    const isPending = connectingId === connector._id || enablingId === connector._id;
                    const label = `${CONNECTOR_ACTION_LABELS[connector.action]} ${connector.name}`;
                    const Icon = CONNECTOR_ACTION_ICONS[connector.action];

                    return (
                        <button
                            key={connector._id}
                            type="button"
                            disabled={isPending}
                            // Stable across the pending swap: the Spinner carries its own "Loading"
                            // label, which would otherwise drop the connector name mid-click.
                            aria-label={label}
                            title={label}
                            onClick={() => onFix(connector)}
                            className={CONNECTOR_CHIP_CLASSES}
                        >
                            {isPending ? (
                                <Spinner className="size-3.5 shrink-0" />
                            ) : (
                                <Icon aria-hidden="true" className="size-3.5 shrink-0 opacity-70" />
                            )}
                            {/* A connector name is user-editable, so an uncapped one would push the
                                chip past the dialog's width. */}
                            <span className="max-w-[220px] truncate">{label}</span>
                        </button>
                    );
                })}
            </div>
        </div>
    </div>
);

const renderCharactersLeft = (value: string, max: number, threshold: number) => {
    const remaining = max - value.length;

    if (remaining > threshold) return null;

    return <span className="self-end text-xs text-muted-foreground tabular-nums">{remaining} characters left</span>;
};

const validateName = (value: string): string | undefined => {
    if (!value.trim()) return 'Routine name is required';
    if (value.length > NAME_MAX_LENGTH) return `Keep the name under ${NAME_MAX_LENGTH} characters`;

    return undefined;
};

const validatePrompt = (value: string): string | undefined => {
    if (!value.trim()) return 'Instructions are required';
    if (value.length > PROMPT_MAX_LENGTH) return `Keep the instructions under ${PROMPT_MAX_LENGTH} characters`;

    return undefined;
};

const RoutineFormBody = ({ routine, agent, project, onClose }: Props) => {
    const areSpacesEnabledRef = useRef(false);

    const timezone = routine?.timezone ?? getBrowserTimezone();
    const triggerState = useRoutineTriggers(routine?._id ?? null, timezone);
    const { data: eventSources } = useRoutineEventSourcesQuery({ enabled: true });

    const { form, isEdit, isPending, currentUserId, recipientError, recipientErrorAction, clearRecipientError } =
        useRoutineForm({
            routine,
            agent,
            project,
            triggerState,
            areSpacesEnabledRef,
            onClose,
        });

    const handleCancel = () => {
        form.reset();
        triggerState.reset();
        onClose();
    };

    const queryClient = useQueryClient();
    const loadAgentOptions = useCallback(
        async (query: string): Promise<ComboboxOption<string>[]> => {
            const agents = await loadChatAgentOptions(queryClient, query.trim());

            return agents.map((agent) => ({ value: agent._id, label: agent.name }));
        },
        [queryClient],
    );

    const selectedAgentId = useStore(form.store, (state) => state.values.agentId);
    const {
        agent: selectedAgent,
        areRoutinesDisabled,
        routinesUnavailableReason,
        isSurfaceProven,
        isAgentUnresolved,
        areSpacesEnabled,
        hasBlockingConnectors,
        blockingConnectors,
        fixConnector,
        connectingId,
        enablingId,
        areConnectorsUnresolved,
    } = useRoutineAgentState(selectedAgentId);
    // A new routine is only attached to an agent proven to be a chat one. An existing routine still opens
    // for editing when its agent's record cannot be read, or a service blip would strand it.
    const isSurfaceUnproven = !isEdit && Boolean(selectedAgentId) && !isAgentUnresolved && !isSurfaceProven;

    areSpacesEnabledRef.current = areSpacesEnabled;

    // The prompt field's subtree re-renders on every keystroke; a stable toolbar element lets React skip it.
    const promptToolbar = (
        <RoutinePromptToolbar
            form={form}
            selectedAgentId={selectedAgentId}
            areSpacesEnabled={areSpacesEnabled}
            routine={routine}
            project={project}
        />
    );

    return (
        <form
            className="flex min-h-0 flex-1 flex-col"
            onSubmit={(e) => {
                e.preventDefault();
                e.stopPropagation();
                // The disabled button is the affordance; this is the guard, since a form submits without it.
                if (areRoutinesDisabled || isSurfaceUnproven || hasBlockingConnectors || areConnectorsUnresolved)
                    return;

                void form.handleSubmit();
            }}
        >
            <DialogBody className="scrollbar-controller scrollbar-vertical flex min-h-0 flex-1 flex-col gap-5 px-4 pt-4 pb-5 lg:px-6">
                <form.Field name="name" validators={{ onChange: ({ value }) => validateName(value) }}>
                    {(field) => (
                        <div className="flex flex-col gap-1.5">
                            <Label htmlFor="routineName" className="text-sm text-text-secondary">
                                Name <span className="text-destructive">*</span>
                            </Label>
                            <div className="flex items-center gap-2">
                                <form.Field name="icon">
                                    {(iconField) => (
                                        <RoutineIconPicker
                                            value={iconField.state.value}
                                            onChange={(key) => iconField.handleChange(key)}
                                        />
                                    )}
                                </form.Field>
                                <Input
                                    id="routineName"
                                    placeholder="Weekly competitor scan"
                                    maxLength={NAME_MAX_LENGTH}
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
                                    isErrored={field.state.meta.errors.length > 0}
                                    className="h-10"
                                />
                            </div>
                            {renderCharactersLeft(field.state.value, NAME_MAX_LENGTH, NAME_COUNTER_THRESHOLD)}
                            {field.state.meta.errors.length > 0 ? (
                                <span className="text-xs text-destructive">{field.state.meta.errors.join(', ')}</span>
                            ) : null}
                        </div>
                    )}
                </form.Field>

                {agent ? null : (
                    <form.Field
                        name="agentId"
                        validators={{
                            onChange: ({ value }) => (!value ? 'An agent is required' : undefined),
                        }}
                    >
                        {(field) => (
                            <div className="flex flex-col gap-1.5">
                                <Label className="text-sm text-text-secondary">
                                    Agent <span className="text-destructive">*</span>
                                </Label>
                                <Select<string>
                                    options={loadAgentOptions}
                                    value={field.state.value || null}
                                    onChange={(value) => {
                                        field.handleChange(value ?? '');
                                        form.setFieldValue('projectId', '');
                                        form.setFieldValue('modelId', '');
                                    }}
                                    placeholder="Select an agent..."
                                    allowSearch
                                    variant="outline"
                                    isErrored={field.state.meta.errors.length > 0}
                                    modal
                                    {...(routine?.agent
                                        ? {
                                              defaultOption: {
                                                  value: routine.agent._id,
                                                  label: routine.agent.name,
                                              },
                                          }
                                        : {})}
                                />
                                {field.state.meta.errors.length > 0 ? (
                                    <span className="text-xs text-destructive">
                                        {field.state.meta.errors.join(', ')}
                                    </span>
                                ) : null}
                            </div>
                        )}
                    </form.Field>
                )}

                {areRoutinesDisabled && selectedAgent
                    ? renderRoutinesDisabledNotice(selectedAgent.name, routinesUnavailableReason)
                    : null}

                {!areRoutinesDisabled && hasBlockingConnectors && selectedAgent
                    ? renderBlockingConnectorsNotice(
                          selectedAgent.name,
                          blockingConnectors,
                          connectingId,
                          enablingId,
                          (connector) => void fixConnector(connector),
                      )
                    : null}

                <RoutineTriggersSection triggerState={triggerState} eventSources={eventSources ?? NO_EVENT_SOURCES} />

                <form.Field name="prompt" validators={{ onChange: ({ value }) => validatePrompt(value) }}>
                    {(field) => (
                        <div className="routine-prompt-field flex flex-col gap-1.5">
                            <Label htmlFor="routinePrompt" className="text-sm text-text-secondary">
                                Instructions <span className="text-destructive">*</span>
                            </Label>
                            <div
                                className={cn(
                                    'routine-prompt-box flex flex-col rounded-xl border border-border-secondary bg-card focus-within:border-primary',
                                    field.state.meta.errors.length > 0
                                        ? 'border-destructive focus-within:border-destructive'
                                        : '',
                                )}
                            >
                                {/* The first row of the composer card, the way the chat banner is:
                                    the Instructions field IS a composer, so the warning belongs on
                                    it. Suppressed while routines are off for the agent, since that
                                    notice is the blocking one. */}
                                {selectedAgentId && !areRoutinesDisabled ? (
                                    <ConnectorHealthBanner agentId={selectedAgentId} />
                                ) : null}
                                <RoutinePromptEditor
                                    id="routinePrompt"
                                    placeholder="Describe what to do on each run — the topic, what to focus on, and how you want the result structured..."
                                    value={field.state.value}
                                    onChange={(value) => field.handleChange(value)}
                                    selectedAgentId={selectedAgentId}
                                    isErrored={field.state.meta.errors.length > 0}
                                />
                                {promptToolbar}
                            </div>
                            {renderCharactersLeft(field.state.value, PROMPT_MAX_LENGTH, PROMPT_COUNTER_THRESHOLD)}
                            {field.state.meta.errors.length > 0 ? (
                                <span className="text-xs text-destructive">{field.state.meta.errors.join(', ')}</span>
                            ) : null}
                            <RoutineModelNotice form={form} selectedAgentId={selectedAgentId} />
                        </div>
                    )}
                </form.Field>

                <form.Field name="emailOnRun">
                    {(field) => (
                        <div className="flex flex-col gap-1.5">
                            <Label className="text-sm text-text-secondary">Notification</Label>
                            <Select<string>
                                options={[
                                    { value: 'email', label: 'Email' },
                                    { value: 'off', label: 'Off' },
                                ]}
                                value={field.state.value ? 'email' : 'off'}
                                onChange={(value) => field.handleChange(value === 'email')}
                                ariaLabel="Notification"
                                variant="outline"
                                modal
                            />
                        </div>
                    )}
                </form.Field>

                {/* Only under Email: an empty list still emails the owner, so the picker can never
                    express "nobody" — that is what Notification: Off means. */}
                <form.Subscribe selector={(state) => state.values.emailOnRun}>
                    {(emailOnRun) =>
                        emailOnRun ? (
                            <form.Field name="recipients">
                                {(field) => (
                                    <RecipientsField
                                        value={field.state.value}
                                        onChange={(value) => {
                                            clearRecipientError();
                                            field.handleChange(value);
                                        }}
                                        currentUserId={currentUserId}
                                        error={recipientError}
                                        errorAction={recipientErrorAction}
                                    />
                                )}
                            </form.Field>
                        ) : null
                    }
                </form.Subscribe>
            </DialogBody>

            <DialogFooter className="justify-end gap-2 border-t border-border px-6 py-4">
                <Button type="button" variant="secondary" size="sm" onClick={handleCancel}>
                    Cancel
                </Button>
                <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                    {([canSubmit, isSubmitting]) => {
                        const busy = isSubmitting || isPending;
                        const busyLabel = isEdit ? 'Saving...' : 'Creating...';
                        const idleLabel = isEdit ? 'Save changes' : 'Create routine';

                        return (
                            <Button
                                type="submit"
                                size="sm"
                                disabled={
                                    !canSubmit ||
                                    busy ||
                                    areRoutinesDisabled ||
                                    isSurfaceUnproven ||
                                    isAgentUnresolved ||
                                    hasBlockingConnectors ||
                                    areConnectorsUnresolved ||
                                    Boolean(triggerState.error)
                                }
                            >
                                {busy ? busyLabel : idleLabel}
                            </Button>
                        );
                    }}
                </form.Subscribe>
            </DialogFooter>
        </form>
    );
};

export default RoutineFormBody;
