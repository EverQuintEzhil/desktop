import cloneDeep from 'lodash/cloneDeep';
import { CheckIcon, ChevronDownIcon, GlobeIcon, PaperclipIcon, SettingsIcon, TelescopeIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import type { SelectSuggestionItem } from '@/components';
import type { AgentComposerState, ComposerActions } from '@/components/agent-chat/types';
import { Button } from '@/components/ui/button';
import { DropDown, type DropDownValueObject } from '@/components/ui/dropdown-menu';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { getSelectedParameterValue } from '@/lib/agent-parameters';
import { getLucideIcon } from '@/lib/icons/lucide-icons';
import type {
    ChatAgentType,
    ModelValueType,
    ParameterTypeRange,
    ParameterTypeSelect,
    ParameterTypeTextbox,
    ParameterTypeToggle,
} from '@/types/admin';
import type { ParameterValue, PlusDropdownOption } from '@/types/chat';
import { resolveAgentAccessFlags } from '@/utils/resolve-agent-access-flags';

import ParameterTextboxSelector from '../controls/parameter-textbox-selector';
import Stepper from '../controls/stepper';
import { resetModelParameters } from '../utils/reset-model-parameters';

import { useAgentConnectors } from './use-agent-connectors';
import { useAgentModelPreference } from './use-agent-model-preference';
import { useSkills } from './use-skills';

export function useAgentComposerOptions(
    agent: ChatAgentType,
    onFilePickerClick: () => void,
    conversationId?: string | null,
): AgentComposerState {
    const availableModels: DropDownValueObject<ModelValueType>[] = useMemo(
        () => (agent.uiConfig.models || []).map((m) => ({ label: m.name, value: m })),
        [agent.uiConfig.models],
    );

    const { persistedModelId, persistModelId } = useAgentModelPreference(agent._id);
    const [userSelectedModelId, setUserSelectedModelId] = useState<string | null>(null);

    // Resolved synchronously, never gated on the preferences request: the first
    // auto-sent message would otherwise carry no modelId and silently run on the
    // backend's own default. The persisted id takes over when it arrives.
    const model = useMemo<DropDownValueObject<ModelValueType> | null>(() => {
        if (userSelectedModelId) {
            const userSelected = availableModels.find((m) => m.value.modelId === userSelectedModelId);

            if (userSelected) return userSelected;
        }

        if (persistedModelId) {
            const persisted = availableModels.find((m) => m.value.modelId === persistedModelId);

            if (persisted) return persisted;
        }

        const defaultModelId = agent.uiConfig.defaultModel?.modelId;

        if (defaultModelId) {
            const found = availableModels.find((m) => m.value.modelId === defaultModelId);

            if (found) return found;
        }

        return availableModels[0] || null;
    }, [availableModels, agent.uiConfig.defaultModel?.modelId, persistedModelId, userSelectedModelId]);

    const setModel = useCallback(
        (next: DropDownValueObject<ModelValueType> | null) => {
            const modelId = next?.value.modelId ?? null;

            setUserSelectedModelId(modelId);

            if (modelId) persistModelId(modelId);
        },
        [persistModelId],
    );

    const [parameters, setParametersState] = useState<Record<string, ParameterValue>>({});
    const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(
        () => agent.uiConfig.home?.search?.isWebSearchEnabled || false,
    );
    const [isDeepSearchEnabled, setIsDeepSearchEnabled] = useState(
        () => agent.uiConfig.home?.search?.isDeepSearchEnabled || false,
    );
    const [isIncognitoMode, setIsIncognitoMode] = useState(false);
    const [isPublic, setIsPublic] = useState(false);
    const [showPlusDropdown, setShowPlusDropdown] = useState(false);
    const [stepperOpenKey, setStepperOpenKey] = useState<string | null>(null);

    const showDeepSearch = Boolean(agent.uiConfig.home?.search?.showDeepSearch);

    const { allowCustomSkills, allowSharedSkills } = resolveAgentAccessFlags(agent);

    const { connectors, customConnectorIds, sharedConnectorIds } = useAgentConnectors(agent);
    const agentSkills = useMemo(() => agent.skills ?? [], [agent.skills]);
    const skills = useSkills({
        agentId: agent._id,
        agentSkills,
        allowCustomSkills,
        allowSharedSkills,
    });
    const composerActionsRef = useRef<ComposerActions | null>(null);

    // Keyed on the id, not the object: `model` is derived, so it takes a fresh
    // identity whenever the `agent` prop does, and an identity check here would
    // re-seed the parameters on every such render.
    const prevModelIdRef = useRef<string | null | undefined>(undefined);
    const prevPersistedModelIdRef = useRef<string | null>(persistedModelId);
    const userSetParameterKeysRef = useRef<Set<string>>(new Set());
    const agentIdRef = useRef(agent._id);
    const conversationIdRef = useRef(conversationId);

    // The app surface remounts this hook per agent, but the admin playground and
    // the published SDK swap the `agent` prop in place, so the previous agent's
    // pick and parameter bookkeeping have to be dropped here rather than by a
    // consumer remembering to pass a `key`.
    if (agentIdRef.current !== agent._id) {
        agentIdRef.current = agent._id;
        prevModelIdRef.current = undefined;
        prevPersistedModelIdRef.current = persistedModelId;
        userSetParameterKeysRef.current = new Set();
        setUserSelectedModelId(null);
        setIsWebSearchEnabled(agent.uiConfig.home?.search?.isWebSearchEnabled || false);
        setIsDeepSearchEnabled(agent.uiConfig.home?.search?.isDeepSearchEnabled || false);
    }

    // A new conversation mints its id mid-turn (null -> id), so only a move away from an
    // already-identified conversation counts as leaving it.
    if (conversationIdRef.current !== conversationId) {
        const leftAnExistingConversation = Boolean(conversationIdRef.current);

        conversationIdRef.current = conversationId;

        if (leftAnExistingConversation) {
            setIsDeepSearchEnabled(agent.uiConfig.home?.search?.isDeepSearchEnabled || false);
        }
    }

    const mergedParameters = useMemo(() => {
        const base = cloneDeep(agent.uiConfig.parameters || {});

        if (model?.value.parameters) {
            Object.assign(base, model.value.parameters);
        }

        return base;
    }, [agent.uiConfig.parameters, model]);

    useEffect(() => {
        const modelId = model?.value.modelId ?? null;
        const hasPersistedArrived = persistedModelId !== prevPersistedModelIdRef.current && !userSelectedModelId;

        prevPersistedModelIdRef.current = persistedModelId;

        if (prevModelIdRef.current === modelId) return;

        const isInitialSeed = prevModelIdRef.current === undefined;

        prevModelIdRef.current = modelId;

        const preservedKeys = !isInitialSeed && hasPersistedArrived ? userSetParameterKeysRef.current : null;

        if (!preservedKeys) userSetParameterKeysRef.current = new Set();

        setParametersState((prev) => resetModelParameters(prev, mergedParameters, preservedKeys));
    }, [model, mergedParameters, persistedModelId, userSelectedModelId]);

    const setParameter = useCallback((key: string, value: ParameterValue) => {
        userSetParameterKeysRef.current.add(key);
        setParametersState((prev) => ({ ...prev, [key]: value }));
    }, []);

    const setParameters = useCallback((params: Record<string, ParameterValue>) => {
        Object.keys(params).forEach((key) => userSetParameterKeysRef.current.add(key));
        setParametersState(params);
    }, []);

    const removeParameter = useCallback((key: string) => {
        userSetParameterKeysRef.current.delete(key);
        setParametersState((prev) => {
            const next = { ...prev };

            delete next[key];

            return next;
        });
    }, []);

    const toggleIncognitoMode = useCallback(() => {
        setIsIncognitoMode((v) => !v);
    }, []);

    const getParameter = useCallback(
        (key: string) => model?.value.parameters?.[key] || agent.uiConfig.parameters?.[key],
        [model, agent.uiConfig.parameters],
    );

    const plusDropdownOptions: PlusDropdownOption[] = useMemo(() => {
        const opts: PlusDropdownOption[] = [
            ...(agent.uiConfig?.home?.search?.files
                ? [
                      {
                          label: 'Add photos & files',
                          value: 'files',
                          icon: PaperclipIcon,
                          onClick: onFilePickerClick,
                      },
                  ]
                : []),
            ...(agent.uiConfig?.home?.search?.showWebSearch && !isWebSearchEnabled
                ? [
                      {
                          label: 'Web Search',
                          value: 'websearch',
                          icon: GlobeIcon,
                          onClick: () => setIsWebSearchEnabled(true),
                      },
                  ]
                : []),
            ...(showDeepSearch && !isDeepSearchEnabled
                ? [
                      {
                          label: 'Deep Research',
                          value: 'deepsearch',
                          icon: TelescopeIcon,
                          onClick: () => setIsDeepSearchEnabled(true),
                      },
                  ]
                : []),
        ];

        const agentParams = agent.uiConfig.parameters || {};
        const modelParams = model?.value.parameters || {};
        const allParamKeys = new Set([...Object.keys(agentParams), ...Object.keys(modelParams)]);

        allParamKeys.forEach((key) => {
            if (parameters[key] !== undefined) return;

            const param = modelParams[key] || agentParams[key];

            if (!param) return;
            const existingIdx = opts.findIndex((o) => o.value === key);

            const resolveSelectedParamValue = (): string | number | boolean | SelectSuggestionItem<string> => {
                if ('component' in param && param.component === 'textbox') return '';

                return getSelectedParameterValue(param);
            };

            const entry: PlusDropdownOption = {
                label: param.label,
                value: key,
                icon: getLucideIcon(param.icon) || SettingsIcon,
                onClick: () => setParameter(key, resolveSelectedParamValue()),
            };

            if (existingIdx !== -1) {
                opts[existingIdx] = entry;
            } else {
                opts.push(entry);
            }
        });

        return opts;
    }, [agent.uiConfig, model, isWebSearchEnabled, isDeepSearchEnabled, onFilePickerClick, parameters, setParameter]);

    const handlePlusDropdownSelect = useCallback((option: PlusDropdownOption) => {
        setShowPlusDropdown(false);
        option.onClick?.();
    }, []);

    const renderSelectedParameters = (): React.ReactNode => {
        return Object.keys(parameters).map((key) => {
            const parameter = getParameter(key) as
                | ParameterTypeSelect
                | ParameterTypeRange
                | ParameterTypeToggle
                | ParameterTypeTextbox
                | undefined;

            if (!parameter || parameters[key] === undefined) return null;

            if ('component' in parameter && parameter.component === 'textbox') {
                return (
                    <ParameterTextboxSelector
                        key={key}
                        parameterKey={key}
                        parameter={parameter as ParameterTypeTextbox & { label: string }}
                        value={typeof parameters[key] === 'string' ? (parameters[key] as string) : ''}
                        setParameter={setParameter}
                        removeParameter={removeParameter}
                    />
                );
            }

            const type = parameter.type || 'select';

            if (type === 'select') {
                const p = parameter as ParameterTypeSelect;
                const Icon = getLucideIcon(parameter.icon) || SettingsIcon;

                return (
                    <div className="selected-parameters flex flex-wrap items-center justify-start gap-2" key={key}>
                        <Button className="select-button h-8 rounded-full pr-3 pl-1" variant="outline">
                            <div
                                className="icon-wrapper flex size-6 items-center justify-center rounded-full"
                                onClick={() => removeParameter(key)}
                            >
                                <Icon className="globe-icon" />
                                <XIcon className="xmark-icon" />
                            </div>
                            <DropDown
                                contentClassName="min-w-[130px] max-w-[220px]"
                                list={p.options.map((o) => ({ label: o.label, value: o.value }))}
                                onSelect={(option: DropDownValueObject<string>) => {
                                    setParameter(key, {
                                        label: option.label || String(option.value),
                                        value: option.value,
                                    });
                                }}
                                renderItem={(option: DropDownValueObject<string>) => {
                                    const selected = (parameters[key] as SelectSuggestionItem<string>) || p.default;
                                    const isSelected = selected && String(selected.value) === String(option.value);

                                    return (
                                        <div className="flex w-full items-center justify-between">
                                            <span className="text-sm">{option.label}</span>
                                            {isSelected ? (
                                                <CheckIcon className="selected-icon size-4 text-primary" />
                                            ) : null}
                                        </div>
                                    );
                                }}
                                renderContent={() => {
                                    const selected = (parameters[key] as SelectSuggestionItem<string>) || p.default;

                                    return (
                                        <div
                                            className={[
                                                'selected-value min-h-[30px] rounded-pill bg-transparent border-0',
                                                'pl-1 pr-[6px] cursor-pointer select-none flex items-center justify-center gap-2',
                                            ].join(' ')}
                                        >
                                            <span className="text-xs">{selected?.label || p.default?.label}</span>
                                            <ChevronDownIcon className="size-4" />
                                        </div>
                                    );
                                }}
                            />
                        </Button>
                    </div>
                );
            }

            if (type === 'range') {
                const p = parameter as ParameterTypeRange;
                const Icon = getLucideIcon(parameter.icon) || SettingsIcon;
                const numValue =
                    typeof parameters[key] === 'number'
                        ? (parameters[key] as number)
                        : Number((parameters[key] as SelectSuggestionItem<string>)?.value || p.default);

                return (
                    <div className="selected-parameters flex flex-wrap items-center justify-start gap-2" key={key}>
                        <Button className="select-button h-8 rounded-full pr-3 pl-1" variant="outline">
                            <div
                                className="icon-wrapper flex size-6 items-center justify-center rounded-full"
                                onClick={() => removeParameter(key)}
                            >
                                <Icon className="globe-icon" />
                                <XIcon className="xmark-icon" />
                            </div>
                            <Popover
                                open={stepperOpenKey === key}
                                onOpenChange={(open) => setStepperOpenKey(open ? key : null)}
                            >
                                <PopoverTrigger asChild>
                                    <span className="text-xs">{numValue}</span>
                                </PopoverTrigger>
                                <PopoverContent align="center" side="bottom" sideOffset={4} className="p-2">
                                    <Stepper
                                        value={numValue}
                                        min={p.range.min}
                                        max={p.range.max}
                                        step={p.range.step}
                                        onChange={(v: number) => setParameter(key, v)}
                                    />
                                </PopoverContent>
                            </Popover>
                        </Button>
                    </div>
                );
            }

            if (type === 'toggle') {
                const p = parameter as ParameterTypeToggle & { label: string };
                const Icon = getLucideIcon(parameter.icon) || SettingsIcon;

                return (
                    <div className="selected-parameters flex flex-wrap items-center justify-start gap-2" key={key}>
                        <Button className="select-button h-8 rounded-full pr-3 pl-1" variant="outline">
                            <div
                                className="icon-wrapper flex size-6 items-center justify-center rounded-full"
                                onClick={() => removeParameter(key)}
                            >
                                <Icon className="globe-icon" />
                                <XIcon className="xmark-icon" />
                            </div>
                            <span className="text-xs">{p.label}</span>
                        </Button>
                    </div>
                );
            }

            return null;
        });
    };

    return {
        model,
        setModel,
        availableModels,
        parameters,
        setParameter,
        setParameters,
        removeParameter,
        isWebSearchEnabled,
        setIsWebSearchEnabled,
        // Gated here rather than at each reader: uiConfig can carry
        // isDeepSearchEnabled without showDeepSearch, which would otherwise run every
        // turn as deep research with no visible control to clear it.
        isDeepSearchEnabled: showDeepSearch && isDeepSearchEnabled,
        setIsDeepSearchEnabled,
        showDeepSearch,
        isIncognitoMode,
        toggleIncognitoMode,
        isPublic,
        setIsPublic,
        plusDropdownOptions,
        handlePlusDropdownSelect,
        showPlusDropdown,
        setShowPlusDropdown,
        renderSelectedParameters,
        connectors,
        customConnectorIds,
        sharedConnectorIds,
        skills,
        composerActionsRef,
    };
}
