import { ArrowUpIcon, GlobeIcon, PaperclipIcon, SettingsIcon, TelescopeIcon, XIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react';
import type { ChangeEvent, KeyboardEvent } from 'react';

import {
    ModelSelector,
    ParameterRangeSelector,
    ParameterSelector,
    ParameterTextboxSelector,
    ParameterToggleSelector,
} from '@/app/screens/private/screens/agent/shared';
import { type SelectSuggestionItem } from '@/components';
import DeepSearchButton from '@/components/agent-chat/controls/deep-search-button';
import PlusDropdown from '@/components/agent-chat/controls/plus-dropdown';
import PublicModeButton from '@/components/agent-chat/controls/public-mode-button';
import WebSearchButton from '@/components/agent-chat/controls/web-search-button';
import { ChatEditor, type ChatEditorRef } from '@/components/agent-chat/view/agent-chat-composer/chat-editor';
import FileTypeIcon from '@/components/file-type-icon';
import TextArea from '@/components/text-area';
import type { TextAreaRef } from '@/components/text-area';
import { Button } from '@/components/ui/button';
import type { DropDownValueObject } from '@/components/ui/dropdown-menu';
import { getSelectedParameterValue, shouldSelectParameterByDefault } from '@/lib/agent-parameters';
import { getLucideIcon } from '@/lib/icons/lucide-icons';
import type {
    ModelValueType,
    ParameterType,
    ParameterTypeRange,
    ParameterTypeSelect,
    ParameterTypeTextbox,
    ParameterTypeToggle,
} from '@/types/admin';
import type { PlusDropdownOption } from '@/types/chat';

import type { ChatUiConfig, GalleryUiConfig, ModelValueSchemaType, ParameterSchemaType } from '../../schema';

import '@/styles/file-preview.scss';
import '@/components/agent-chat/view/home/home.scss';

type PreviewParameterValue = number | boolean | string | SelectSuggestionItem<string>;
type PreviewParametersState = Record<string, PreviewParameterValue>;
type PreviewParameterMap = Record<string, ParameterType>;

interface Props {
    value: ChatUiConfig | GalleryUiConfig;
    promptPlaceholder: string;
}

const DEFAULT_CHAT_ACCEPT = '';

const normalizeSelectOption = (option: { label: string; value: string | number }) => ({
    label: option.label,
    value: String(option.value),
});

const normalizePreviewParameter = (parameter: ParameterSchemaType): ParameterType | null => {
    if ('component' in parameter && parameter.component === 'textbox') {
        return {
            label: parameter.label,
            icon: parameter.icon,
            component: 'textbox' as const,
        };
    }

    if ('component' in parameter) {
        return null;
    }

    if (parameter.type === 'range') {
        return {
            label: parameter.label,
            icon: parameter.icon,
            showDefault: parameter.showDefault,
            type: 'range',
            default: parameter.default,
            range: parameter.range,
        };
    }

    if (parameter.type === 'toggle') {
        return {
            label: parameter.label,
            icon: parameter.icon,
            showDefault: parameter.showDefault,
            type: 'toggle',
            default: parameter.default,
            inverse: parameter.inverse,
        };
    }

    if (!('default' in parameter) || !('options' in parameter)) {
        return null;
    }

    return {
        label: parameter.label,
        icon: parameter.icon,
        showDefault: parameter.showDefault,
        type: 'select',
        default: normalizeSelectOption(parameter.default),
        options: parameter.options.map(normalizeSelectOption),
    };
};

const normalizePreviewParameters = (parameters?: Record<string, ParameterSchemaType>): PreviewParameterMap => {
    const normalizedParameters: PreviewParameterMap = {};

    Object.entries(parameters ?? {}).forEach(([key, parameter]) => {
        const normalizedParameter = normalizePreviewParameter(parameter);

        if (normalizedParameter) {
            normalizedParameters[key] = normalizedParameter;
        }
    });

    return normalizedParameters;
};

const normalizePreviewModel = (model: ModelValueSchemaType): ModelValueType => ({
    name: model.name,
    modelId: model.modelId,
    options: model.options,
    parameters: normalizePreviewParameters(model.parameters),
});

const createModelDropdownValue = (model: ModelValueSchemaType): DropDownValueObject<ModelValueType> => {
    const normalizedModel = normalizePreviewModel(model);

    return {
        label: normalizedModel.name,
        value: normalizedModel,
    };
};

const getInitialSelectedModel = (
    value: ChatUiConfig | GalleryUiConfig,
    availableModels: DropDownValueObject<ModelValueType>[],
): DropDownValueObject<ModelValueType> | null => {
    if (value.defaultModel) {
        const defaultModel = availableModels.find((model) => model.value.modelId === value.defaultModel?.modelId);

        if (defaultModel) {
            return defaultModel;
        }

        return createModelDropdownValue(value.defaultModel);
    }

    return availableModels[0] ?? null;
};

interface ParametersState {
    values: PreviewParametersState;
    manualKeys: Set<string>;
}

type ParametersAction =
    | { type: 'sync'; available: PreviewParameterMap }
    | { type: 'set'; key: string; value: PreviewParameterValue }
    | { type: 'remove'; key: string };

const parametersReducer = (state: ParametersState, action: ParametersAction): ParametersState => {
    switch (action.type) {
        case 'sync': {
            const next = { ...state.values };

            Object.keys(next).forEach((key) => {
                const param = action.available[key];

                if (!param || (!shouldSelectParameterByDefault(param) && !state.manualKeys.has(key))) {
                    delete next[key];

                    return;
                }

                next[key] = getSelectedParameterValue(param);
            });

            Object.entries(action.available).forEach(([key, param]) => {
                if (shouldSelectParameterByDefault(param) && next[key] === undefined) {
                    next[key] = getSelectedParameterValue(param);
                }
            });

            return {
                values: next,
                manualKeys: new Set([...state.manualKeys].filter((k) => action.available[k])),
            };
        }
        case 'set':
            return {
                values: { ...state.values, [action.key]: action.value },
                manualKeys: new Set([...state.manualKeys, action.key]),
            };
        case 'remove': {
            const nextManual = new Set(state.manualKeys);

            nextManual.delete(action.key);

            const nextValues = { ...state.values };

            delete nextValues[action.key];

            return { values: nextValues, manualKeys: nextManual };
        }
    }
};

const isChatConfig = (value: ChatUiConfig | GalleryUiConfig): value is ChatUiConfig => value.componentType === 'chat';

const GalleryPromptInputPreview = (props: Props) => {
    const { value, promptPlaceholder } = props;

    const textAreaRef = useRef<TextAreaRef>(null);
    const chatEditorRef = useRef<ChatEditorRef>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const [query, setQuery] = useState('');
    const [isPublic, setIsPublic] = useState(isChatConfig(value) ? false : (value.isPublic ?? false));
    const [isWebSearchEnabled, setIsWebSearchEnabled] = useState(
        isChatConfig(value) ? (value.home.search?.isWebSearchEnabled ?? false) : false,
    );
    const [isDeepSearchEnabled, setIsDeepSearchEnabled] = useState(
        isChatConfig(value) ? (value.home.search?.isDeepSearchEnabled ?? false) : false,
    );
    const [showPlusDropdown, setShowPlusDropdown] = useState(false);
    const [previewFileName, setPreviewFileName] = useState<string | null>(null);
    const [{ values: parameters }, dispatch] = useReducer(parametersReducer, {
        values: {},
        manualKeys: new Set<string>(),
    });
    const isChat = isChatConfig(value);
    const showFileOption = isChat ? (value.home.search?.files ?? false) : true;
    const showWebSearchOption = isChat ? (value.home.search?.showWebSearch ?? false) : false;
    const showDeepSearchOption = isChat ? (value.home.search?.showDeepSearch ?? false) : false;
    const showPublicPrivateToggle = isChat ? false : (value.showPublicPrivateToggle ?? false);
    const fileOptionLabel = isChat ? 'Add photos & files' : 'Add photo';
    const fileAccept = isChat
        ? (value.home.search?.accept ?? DEFAULT_CHAT_ACCEPT)
        : 'image/jpg,image/jpeg,image/png,image/gif';

    const baseParameters = useMemo(() => normalizePreviewParameters(value.parameters), [value.parameters]);

    const availableModels = useMemo(() => (value.models ?? []).map(createModelDropdownValue), [value.models]);

    const initialSelectedModel = useMemo(
        () => getInitialSelectedModel(value, availableModels),
        [availableModels, value],
    );

    const [selectedModel, setSelectedModel] = useState<DropDownValueObject<ModelValueType> | null>(
        initialSelectedModel,
    );

    const mergedParameters = useMemo<PreviewParameterMap>(
        () => ({
            ...baseParameters,
            ...(selectedModel?.value.parameters ?? {}),
        }),
        [baseParameters, selectedModel],
    );

    useEffect(() => {
        setIsPublic(isChatConfig(value) ? false : (value.isPublic ?? false));
        setIsWebSearchEnabled(isChatConfig(value) ? (value.home.search?.isWebSearchEnabled ?? false) : false);
        setIsDeepSearchEnabled(isChatConfig(value) ? (value.home.search?.isDeepSearchEnabled ?? false) : false);
    }, [value]);

    useEffect(() => {
        setSelectedModel(initialSelectedModel);
    }, [initialSelectedModel]);

    useEffect(() => {
        dispatch({ type: 'sync', available: mergedParameters });
    }, [mergedParameters]);

    const setParameter = useCallback((key: string, value: PreviewParameterValue) => {
        dispatch({ type: 'set', key, value });
    }, []);

    const removeParameter = useCallback((key: string) => {
        dispatch({ type: 'remove', key });
    }, []);

    const handleAddPhoto = useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];

        if (!file) {
            return;
        }

        setPreviewFileName(file.name);
    };

    const plusDropdownOptions = useMemo<PlusDropdownOption[]>(() => {
        const parameterOptions = Object.entries(mergedParameters).map(([key, parameter]) => {
            const ParameterIcon = getLucideIcon(parameter.icon) ?? SettingsIcon;

            return {
                label: parameter.label,
                value: key,
                icon: ParameterIcon,
                onClick: () => setParameter(key, getSelectedParameterValue(parameter)),
            };
        });

        return [
            ...(showFileOption
                ? [
                      {
                          label: fileOptionLabel,
                          value: 'add-photo',
                          icon: PaperclipIcon,
                          onClick: handleAddPhoto,
                      },
                  ]
                : []),
            ...(showWebSearchOption
                ? [
                      {
                          label: 'Web Search',
                          value: 'websearch',
                          icon: GlobeIcon,
                          onClick: () => setIsWebSearchEnabled((current) => !current),
                      },
                  ]
                : []),
            ...(showDeepSearchOption
                ? [
                      {
                          label: 'Deep Research',
                          value: 'deepsearch',
                          icon: TelescopeIcon,
                          onClick: () => setIsDeepSearchEnabled((current) => !current),
                      },
                  ]
                : []),
            ...parameterOptions,
        ];
    }, [
        fileOptionLabel,
        handleAddPhoto,
        mergedParameters,
        setParameter,
        showDeepSearchOption,
        showFileOption,
        showWebSearchOption,
    ]);

    const handlePlusDropdownSelect = (option: PlusDropdownOption) => {
        option.onClick();
        setShowPlusDropdown(false);
    };

    const handleSubmitPreview = () => {
        (chatEditorRef.current ?? textAreaRef.current)?.focus();
    };

    const handleInputKeyDown = (event: KeyboardEvent<HTMLParagraphElement>) => {
        if (event.key !== 'Enter' || event.shiftKey) {
            return;
        }

        event.preventDefault();
        handleSubmitPreview();
    };

    const renderTextArea = () => {
        if (isChat) {
            return (
                <ChatEditor
                    ref={chatEditorRef}
                    value={query}
                    onChange={setQuery}
                    placeholder={promptPlaceholder}
                    mentionsEnabled={false}
                    variableTooltip="Click to fill in this variable"
                    onEnter={() => {
                        handleSubmitPreview();

                        return true;
                    }}
                />
            );
        }

        return (
            <TextArea
                ref={textAreaRef}
                value={query}
                onChange={setQuery}
                placeholder={promptPlaceholder}
                onKeyDown={handleInputKeyDown}
            />
        );
    };

    const renderFiles = () => {
        if (!previewFileName) {
            return null;
        }

        return (
            <div className="image-list scrollbar-controller scrollbar-vertical scrollbar-horizontal flex w-full items-center gap-2 pt-2">
                <div className="image-list-item relative flex">
                    <div className="custom-thumbnail-wrapper ask-here flex w-full max-w-[240px] items-center gap-2 rounded-md p-1">
                        <div className="thumbnail flex size-8 shrink-0 items-center justify-center">
                            <FileTypeIcon file={{ name: previewFileName }} />
                        </div>
                        <span className="text-sm">{previewFileName}</span>
                    </div>
                    <Button
                        size="icon-sm"
                        variant="outline"
                        onClick={() => {
                            setPreviewFileName(null);
                            if (fileInputRef.current) {
                                fileInputRef.current.value = '';
                            }
                        }}
                    >
                        <XIcon />
                    </Button>
                </div>
            </div>
        );
    };

    const renderSelectedParameters = () =>
        Object.keys(parameters).map((key) => {
            const parameter = mergedParameters[key];

            if (!parameter || parameters[key] === undefined) {
                return null;
            }

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

            if (parameter.type === 'range') {
                return (
                    <ParameterRangeSelector
                        key={key}
                        parameterKey={key}
                        parameter={parameter as ParameterTypeRange & { label: string }}
                        parameters={parameters}
                        removeParameter={removeParameter}
                        setParameter={setParameter}
                    />
                );
            }

            if (parameter.type === 'toggle') {
                return (
                    <ParameterToggleSelector
                        key={key}
                        parameterKey={key}
                        parameter={parameter as ParameterTypeToggle & { label: string }}
                        removeParameter={removeParameter}
                    />
                );
            }

            return (
                <ParameterSelector
                    key={key}
                    parameterKey={key}
                    parameter={parameter as ParameterTypeSelect & { label: string }}
                    parameters={parameters}
                    removeParameter={removeParameter}
                    setParameter={setParameter}
                />
            );
        });

    return (
        <div className="chat-block next-line flex flex-wrap items-center gap-2 px-4">
            {renderFiles()}
            <input
                ref={fileInputRef}
                className="file-upload hidden"
                accept={fileAccept}
                multiple
                onChange={handleFileChange}
                type="file"
            />
            {renderTextArea()}
            <div className="chat-options flex flex-wrap items-center justify-start gap-2">
                {plusDropdownOptions.length === 0 ? null : (
                    <div>
                        <PlusDropdown
                            isOpen={showPlusDropdown}
                            onToggle={() => setShowPlusDropdown(!showPlusDropdown)}
                            onClose={() => setShowPlusDropdown(false)}
                            onSelect={handlePlusDropdownSelect}
                            options={plusDropdownOptions}
                            align="start"
                            side="top"
                        />
                    </div>
                )}
                <PublicModeButton
                    isEnabled={showPublicPrivateToggle}
                    isPublic={isPublic}
                    onToggle={() => setIsPublic(!isPublic)}
                />
                <WebSearchButton isEnabled={isWebSearchEnabled} onToggle={() => setIsWebSearchEnabled(false)} />
                <DeepSearchButton isEnabled={isDeepSearchEnabled} onToggle={() => setIsDeepSearchEnabled(false)} />
                <ModelSelector
                    selectedModel={selectedModel}
                    availableModels={availableModels}
                    onSelect={setSelectedModel}
                />
            </div>
            {renderSelectedParameters()}
            <Button
                size="icon-sm"
                variant="outline"
                className="button-send justify-center rounded-full"
                disabled={!query.trim()}
                onClick={handleSubmitPreview}
            >
                <ArrowUpIcon />
            </Button>
        </div>
    );
};

export default GalleryPromptInputPreview;
