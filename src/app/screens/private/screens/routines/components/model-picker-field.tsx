import { useEffect, useRef } from 'react';

import Select from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { modelDisplayName } from '@/types/admin';

import { AGENT_DEFAULT_MODEL_VALUE, useModelFieldState } from '../hooks/use-model-field-state';

export interface Props {
    agentId: string;
    value: string;
    /** Name of the routine's stored model, so one an admin has since unassigned still reads as itself. */
    storedModelLabel?: string;
    onChange: (modelId: string) => void;
}

const ModelPickerField = ({ agentId, value, storedModelLabel, onChange }: Props) => {
    const { agent, isPending, isError, options, defaultModel, isStale } = useModelFieldState(agentId, value);
    const firstOptionValue = options[0]?.value;
    // Without an agent default, `modelId: null` guarantees every run fails, so the field never rests there.
    const needsPreselect = Boolean(agent) && !isError && !defaultModel && value === AGENT_DEFAULT_MODEL_VALUE;

    const onChangeRef = useRef(onChange);

    onChangeRef.current = onChange;

    useEffect(() => {
        if (needsPreselect && firstOptionValue) onChangeRef.current(firstOptionValue);
    }, [needsPreselect, firstOptionValue]);

    if (isPending) return <Skeleton className="model-picker-field h-8 w-32 rounded-full" />;

    if (isError || !agent) return null;

    const selectOptions = [
        ...(defaultModel
            ? [{ value: AGENT_DEFAULT_MODEL_VALUE, label: `Agent default (${modelDisplayName(defaultModel)})` }]
            : []),
        ...options,
        ...(isStale ? [{ value, label: storedModelLabel ?? 'Model no longer available' }] : []),
    ];

    if (selectOptions.length === 0) return null;

    return (
        <Select<string>
            options={selectOptions}
            value={value}
            onChange={(next) => onChange(next ?? AGENT_DEFAULT_MODEL_VALUE)}
            ariaLabel="Model"
            variant="ghost"
            className="model-picker-field h-8 max-w-[220px] rounded-full border-0 px-2 font-normal hover:bg-accent"
            triggerLabelClassName="text-xs text-(--text-secondary)"
            triggerChevronIconClassName="size-3.5 opacity-60"
            popoverClassName="min-w-max max-w-[280px]"
            placeholder="Model"
            modal
        />
    );
};

export default ModelPickerField;
