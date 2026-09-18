import { ArrowUpIcon, FilmIcon, Loader2Icon, PencilIcon, RepeatIcon } from 'lucide-react';
import { useState } from 'react';

import PlusDropdown from '@/components/agent-chat/controls/plus-dropdown';
import PublicModeButton from '@/components/agent-chat/controls/public-mode-button';
import TextArea from '@/components/text-area';
import { Button } from '@/components/ui/button';
import type { DropDownValueObject } from '@/components/ui/dropdown-menu';
import type { GalleryAgentType, ModelValueType } from '@/types/admin';
import type { PlusDropdownOption } from '@/types/chat';

import ModelSelector from '../../../../shared/model-selector';
import type { ParameterPopupStylesOverrides } from '../../hooks/use-gallery-prompt-options';

import './remix-input.scss';

export interface RemixInputPlusOptions {
    plusDropdownOptions: PlusDropdownOption[];
    handlePlusDropdownSelect: (option: PlusDropdownOption) => void;
    renderSelectedParameters: (overrides?: ParameterPopupStylesOverrides, isDarkMode?: boolean) => React.ReactNode;
    selectedModel: DropDownValueObject<ModelValueType> | null;
    availableModels: DropDownValueObject<ModelValueType>[];
    setSelectedModel: (model: DropDownValueObject<ModelValueType> | null) => void;
    isPublic: boolean;
    setIsPublic: (isPublic: boolean) => void;
    showPublicPrivateToggle: boolean;
    canChangeVisibility?: boolean;
    isNextLine?: boolean;
    setDefaultParameters?: (defaultParameters: unknown, modelId: string) => void;
    resetDefaultParameters?: () => void;
}

interface PropsType {
    agent: GalleryAgentType;
    onRemix?: (e: React.FormEvent, prompt: string) => void;
    onToggle: (e: React.MouseEvent) => void;
    showRemixInput: boolean;
    query: string;
    setQuery: (value: string) => void;
    plusOptions: RemixInputPlusOptions;
    plusDropdownPopupStyles?: string;
    modelSelectorPopupStyles?: string;
    parameterSelectPopupStyles?: string;
    parameterStepperPopupStyles?: string;
    parameterButtonStyles?: string;
    onEditPromptClick?: (e: React.MouseEvent) => void;
    isVideo?: boolean;
    onCreateVideoClick?: (e: React.MouseEvent) => void;
    isDarkMode?: boolean;
    isLoading?: boolean;
    fileInputDisabled?: boolean;
    renderFiles?: () => React.ReactNode;
}

const RemixInput = (props: PropsType) => {
    const {
        onRemix,
        onToggle,
        showRemixInput,
        query,
        setQuery,
        plusOptions,
        modelSelectorPopupStyles,
        parameterSelectPopupStyles,
        parameterStepperPopupStyles,
        parameterButtonStyles,
        onEditPromptClick,
        isVideo = false,
        onCreateVideoClick,
        isDarkMode = false,
        isLoading = false,
        fileInputDisabled = false,
        renderFiles,
    } = props;
    const [showPlusDropdown, setShowPlusDropdown] = useState(false);

    const {
        plusDropdownOptions: allPlusDropdownOptions,
        handlePlusDropdownSelect,
        renderSelectedParameters,
        selectedModel,
        availableModels,
        setSelectedModel,
        isPublic,
        setIsPublic,
        showPublicPrivateToggle,
        canChangeVisibility = true,
    } = plusOptions;

    const handleRemixSubmit = (e: React.FormEvent) => {
        if (query.trim() && onRemix && !fileInputDisabled && !isLoading) {
            onRemix(e, query.trim());
            setQuery('');
        }
    };

    return (
        <>
            <div
                className={`edit-prompt-section flex w-full flex-col gap-2 px-4 ${showRemixInput ? 'remix-open-textarea' : ''}`}
            >
                {showRemixInput ? (
                    <>
                        <div
                            className="textarea-container flex w-full flex-col gap-2"
                            onClick={(e) => e.stopPropagation()}
                        >
                            {renderFiles?.()}
                            <TextArea
                                value={query}
                                autoFocus
                                onChange={setQuery}
                                className={`${showRemixInput ? 'dark-mode' : ''}`}
                                placeholder="Enter your remix prompt..."
                                onKeyDown={(event) => {
                                    if (event.key === 'Enter' && !event.shiftKey) {
                                        event.preventDefault();
                                        handleRemixSubmit(event);
                                    }
                                }}
                            />
                            <div className="remix-options-row options-container flex flex-wrap items-center justify-between gap-1.5">
                                <div className="options-container flex items-center gap-1.5">
                                    {allPlusDropdownOptions.length > 0 && (
                                        <PlusDropdown
                                            isOpen={showPlusDropdown}
                                            onToggle={() => {
                                                setShowPlusDropdown(!showPlusDropdown);
                                            }}
                                            onClose={() => {
                                                setShowPlusDropdown(false);
                                            }}
                                            onSelect={(option) => {
                                                handlePlusDropdownSelect(option);
                                                setShowPlusDropdown(false);
                                            }}
                                            options={allPlusDropdownOptions}
                                            side="bottom"
                                            align="start"
                                            isDarkMode={isDarkMode}
                                        />
                                    )}
                                    <PublicModeButton
                                        isEnabled={showPublicPrivateToggle}
                                        isPublic={isPublic}
                                        canToggle={canChangeVisibility}
                                        onToggle={() => setIsPublic(!isPublic)}
                                        isDarkMode={isDarkMode}
                                    />
                                    <ModelSelector
                                        selectedModel={selectedModel}
                                        availableModels={availableModels}
                                        onSelect={setSelectedModel}
                                        popupStyles={modelSelectorPopupStyles}
                                        isDarkMode={isDarkMode}
                                    />
                                </div>
                                {renderSelectedParameters(
                                    showRemixInput
                                        ? {
                                              parameterSelectPopupStyles,
                                              parameterStepperPopupStyles,
                                              parameterButtonStyles,
                                          }
                                        : undefined,
                                    true,
                                )}
                                <Button
                                    size="icon-sm"
                                    variant={isDarkMode ? 'black' : 'outline'}
                                    className="ml-auto rounded-full"
                                    disabled={!query.trim() || isLoading || fileInputDisabled}
                                    onClick={handleRemixSubmit}
                                >
                                    {isLoading ? <Loader2Icon className="animate-spin" /> : <ArrowUpIcon />}
                                </Button>
                            </div>
                        </div>
                    </>
                ) : (
                    <div className="remix-buttons-container flex items-center justify-center gap-2">
                        {onEditPromptClick && (
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onEditPromptClick(e);
                                }}
                                variant="black"
                                size="sm"
                                className="edit-prompt-button flex h-11 flex-col justify-center font-medium"
                            >
                                <PencilIcon />
                                Edit Prompt
                            </Button>
                        )}
                        {onRemix && (
                            <Button
                                onClick={onToggle}
                                variant="black"
                                size="sm"
                                className="remix-button flex h-11 flex-col justify-center"
                            >
                                <RepeatIcon />
                                Remix
                            </Button>
                        )}
                        {!isVideo && (
                            <Button
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onCreateVideoClick?.(e);
                                }}
                                variant="black"
                                size="sm"
                                className="create-video-button flex h-11 flex-col justify-center"
                            >
                                <FilmIcon />
                                Create Video
                            </Button>
                        )}
                    </div>
                )}
            </div>
        </>
    );
};

export default RemixInput;
