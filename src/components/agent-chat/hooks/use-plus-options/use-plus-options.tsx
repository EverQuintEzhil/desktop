import { useMemo, useRef, useState } from 'react';

import ComposerFilePreviewList from '@/components/chat/primitives/composer-file-preview-list';
import type { TextAreaRef } from '@/components/text-area';
import type { ChatAgentType } from '@/types/admin';

import { useAgentComposerContext } from '../../context/agent-composer-context';
import useTextWrapDetection from '../use-text-wrap-detection';

import './use-plus-options.scss';

interface Props {
    agent: ChatAgentType;
    initialPrompt?: string;
}

const usePlusOptions = (props: Props) => {
    const { initialPrompt } = props;
    const { composer, filesState } = useAgentComposerContext();

    const [query, setQuery] = useState(initialPrompt || '');
    const textAreaRef = useRef<TextAreaRef>(null);
    const hasTextWrapped = useTextWrapDetection(textAreaRef, query);

    const isNextLine = useMemo(() => {
        return (
            hasTextWrapped ||
            composer.isWebSearchEnabled ||
            composer.isDeepSearchEnabled ||
            composer.isPublic ||
            composer.availableModels.length > 1 ||
            Object.keys(composer.parameters).length > 0
        );
    }, [
        hasTextWrapped,
        composer.isWebSearchEnabled,
        composer.isDeepSearchEnabled,
        composer.isPublic,
        composer.parameters,
        composer.availableModels.length,
    ]);

    const renderFiles = () => {
        if (filesState.files.length === 0) return null;

        return (
            <ComposerFilePreviewList
                files={filesState.files}
                fileInputRef={filesState.fileInputRef}
                onRemove={(index) => filesState.setFiles(filesState.files.filter((_, i) => i !== index))}
                onRetry={filesState.retryUpload}
            />
        );
    };

    return {
        query,
        setQuery,
        textAreaRef,
        fileInputRef: filesState.fileInputRef,
        showPlusDropdown: composer.showPlusDropdown,
        setShowPlusDropdown: composer.setShowPlusDropdown,
        plusDropdownOptions: composer.plusDropdownOptions,
        handlePlusDropdownSelect: composer.handlePlusDropdownSelect,
        renderFiles,
        renderSelectedParameters: composer.renderSelectedParameters,
        selectedModel: composer.model,
        availableModels: composer.availableModels,
        setSelectedModel: composer.setModel,
        isNextLine,
    };
};

export default usePlusOptions;
