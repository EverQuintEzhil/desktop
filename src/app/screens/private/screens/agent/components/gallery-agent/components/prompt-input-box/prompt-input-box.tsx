import { ArrowUpIcon } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

import PlusDropdown from '@/components/agent-chat/controls/plus-dropdown';
import PublicModeButton from '@/components/agent-chat/controls/public-mode-button';
import TextArea from '@/components/text-area';
import type { TextAreaRef } from '@/components/text-area';
import { Button } from '@/components/ui/button';
import type { DropDownValueObject } from '@/components/ui/dropdown-menu';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils';
import type { GalleryAgentType, ModelValueType } from '@/types/admin';
import type { PlusDropdownOption } from '@/types/chat';
import { getDefaultToastOptions } from '@/utils/toast-theme';

import ModelSelector from '../../../../shared/model-selector';

import { usePromptTriggerSuggestions } from './use-prompt-trigger-suggestions';

import '@/components/agent-chat/view/home/home.scss';

import './prompt-input-box.scss';

interface Props {
    agent: GalleryAgentType;
    query: string;
    setQuery: (query: string) => void;
    onSubmit: () => void;
    textAreaRef: React.RefObject<TextAreaRef | null>;
    placeholder?: string;
    isLoading?: boolean;
    variant?: 'light' | 'dark';
    plusDropdownPopupStyles?: string;
    modelSelectorPopupStyles?: string;
    parameterSelectPopupStyles?: string;
    parameterStepperPopupStyles?: string;
    parameterButtonStyles?: string;

    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onChangeFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
    accept?: string;
    fileInputDisabled: boolean;
    isUploading?: boolean;
    renderFiles: () => React.ReactNode;

    plusOptions: {
        plusDropdownOptions: PlusDropdownOption[];
        handlePlusDropdownSelect: (option: PlusDropdownOption) => void;
        renderSelectedParameters: (
            overrides?: {
                parameterSelectPopupStyles?: string;
                parameterStepperPopupStyles?: string;
                parameterButtonStyles?: string;
            },
            isDarkMode?: boolean,
        ) => React.ReactNode;
        selectedModel: DropDownValueObject<ModelValueType> | null;
        availableModels: DropDownValueObject<ModelValueType>[];
        setSelectedModel: (model: DropDownValueObject<ModelValueType> | null) => void;
        isPublic: boolean;
        setIsPublic: (isPublic: boolean) => void;
        showPublicPrivateToggle: boolean;
        canChangeVisibility?: boolean;
        isNextLine: boolean;
    };
}

const PromptInputBox = (props: Props) => {
    const {
        agent,
        query,
        setQuery,
        onSubmit,
        textAreaRef,
        placeholder,
        isLoading = false,
        fileInputRef,
        onChangeFile,
        accept,
        fileInputDisabled,
        isUploading = false,
        renderFiles,
        plusOptions,
        variant = 'light',
    } = props;

    const [showPlusDropdown, setShowPlusDropdown] = useState(false);

    const {
        plusDropdownOptions,
        handlePlusDropdownSelect,
        renderSelectedParameters,
        selectedModel,
        availableModels,
        setSelectedModel,
        isPublic,
        setIsPublic,
        showPublicPrivateToggle,
        canChangeVisibility = true,
        isNextLine,
    } = plusOptions;

    const isSubmitDisabled = !query.trim() || isLoading || fileInputDisabled;

    const {
        closeTriggerWithDelay,
        handleQueryChange,
        handleTriggerKeyDown,
        renderTriggerCommandBox,
        updateTriggerAfterDomChange,
    } = usePromptTriggerSuggestions({
        agent,
        query,
        setQuery,
        textAreaRef,
        plusDropdownOptions,
        handlePlusDropdownSelect,
        onCommandSelect: () => setShowPlusDropdown(false),
    });

    return (
        <div
            className={cn(
                'chat-block gallery-prompt-input-box flex flex-wrap items-center gap-2 px-4',
                isNextLine && 'next-line',
                variant === 'dark' && 'dark-theme-wrapper',
            )}
        >
            {renderFiles()}
            <input
                ref={fileInputRef}
                className="file-upload hidden"
                accept={accept || 'image/*'}
                multiple
                onChange={onChangeFile}
                type="file"
                disabled={fileInputDisabled}
            />
            <div className="chat-composer-input-wrap">
                {renderTriggerCommandBox()}
                <TextArea
                    ref={textAreaRef}
                    value={query}
                    autoFocus
                    onChange={handleQueryChange}
                    className={`${variant === 'dark' ? 'dark-mode' : ''}`}
                    placeholder={placeholder || 'Ask anything'}
                    onClick={updateTriggerAfterDomChange}
                    onKeyUp={updateTriggerAfterDomChange}
                    onBlur={closeTriggerWithDelay}
                    onKeyDown={(event: React.KeyboardEvent<HTMLParagraphElement>) => {
                        if (handleTriggerKeyDown(event)) return;

                        if (event.key === 'Enter') {
                            if (!event.shiftKey) {
                                event.preventDefault();
                                if (!isSubmitDisabled) {
                                    onSubmit();
                                } else if (isUploading) {
                                    toast('Please wait for files to finish uploading', getDefaultToastOptions());
                                }
                            }
                        }
                    }}
                />
            </div>

            <div className="chat-options flex flex-wrap items-center justify-start gap-2">
                {plusDropdownOptions.length === 0 ? null : (
                    <div>
                        <PlusDropdown
                            isOpen={showPlusDropdown}
                            onToggle={() => setShowPlusDropdown(!showPlusDropdown)}
                            onClose={() => setShowPlusDropdown(false)}
                            onSelect={(option) => {
                                handlePlusDropdownSelect(option);
                                setShowPlusDropdown(false);
                            }}
                            options={plusDropdownOptions}
                            align="start"
                            side="top"
                            isDarkMode={variant === 'dark'}
                            // popupStyles={plusDropdownPopupStyles}
                        />
                    </div>
                )}
                <PublicModeButton
                    isEnabled={showPublicPrivateToggle}
                    isPublic={isPublic}
                    canToggle={canChangeVisibility}
                    onToggle={() => setIsPublic(!isPublic)}
                    isDarkMode={variant === 'dark'}
                />
                <ModelSelector
                    selectedModel={selectedModel}
                    availableModels={availableModels}
                    onSelect={setSelectedModel}
                    isDarkMode={variant === 'dark'}
                />
            </div>
            {renderSelectedParameters(undefined, variant === 'dark')}
            <Button
                size="icon-sm"
                variant={variant === 'dark' ? 'black' : 'outline'}
                className="button-send justify-center rounded-full"
                disabled={isSubmitDisabled}
                onClick={onSubmit}
            >
                {isLoading ? <Spinner /> : <ArrowUpIcon />}
            </Button>
        </div>
    );
};

export default PromptInputBox;
