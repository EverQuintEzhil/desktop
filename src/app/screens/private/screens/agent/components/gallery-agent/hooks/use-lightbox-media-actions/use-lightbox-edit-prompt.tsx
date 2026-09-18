import { useEffect, useRef, useState } from 'react';

import type { TextAreaRef } from '@/components/text-area';
import { useUploadFilesContext } from '@/context';
import type { FileType, GalleryAgentType, ModelValueType } from '@/types/admin';
import type { GeneratedItem } from '@/types/gallery';
import { showErrorToast } from '@/utils';

import { EditPromptOverlay } from '../../components/edit-prompt-overlay';
import { PromptInputBox } from '../../components/prompt-input-box';
import type { RemixInputPlusOptions } from '../../components/remix-input';
import {
    getImageUploadLimitMessage,
    getModelMaxImageUploads,
    limitUploadedImages,
} from '../../utils/model-image-upload-limit';

export interface UseLightboxEditPromptArgs {
    currentItem: GeneratedItem | null;
    relatedFiles: FileType[];
    selectedModel?: ModelValueType | null;
    controlledShowEditPromptModal?: boolean;
    controlledSetShowEditPromptModal?: (v: boolean) => void;
    setDefaultParameters?: (defaultParameters: unknown, modelId: string) => void;
    resetDefaultParameters?: () => void;
    onChangeFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
    renderFiles: () => React.ReactNode;
    fileInputDisabled: boolean;
    onEditPromptSubmit?: (prompt: string) => void;
    blackThemePopupStyle: string;
    parameterButtonStyles: string;
}

export interface UseLightboxEditPromptResult {
    showEditPromptModal: boolean;
    setShowEditPromptModal: (v: boolean) => void;
    openEditPromptModal: () => void;
    editPromptValue: string;
    setEditPromptValue: (v: string) => void;
    editPromptTextAreaRef: React.RefObject<TextAreaRef | null>;
    renderEditPromptModal: (props: {
        agent: GalleryAgentType;
        setQuery: (value: string) => void;
        plusOptions: RemixInputPlusOptions;
    }) => React.ReactNode;
}

export const useLightboxEditPrompt = (args: UseLightboxEditPromptArgs): UseLightboxEditPromptResult => {
    const {
        currentItem,
        relatedFiles,
        selectedModel,
        controlledShowEditPromptModal,
        controlledSetShowEditPromptModal,
        setDefaultParameters,
        resetDefaultParameters,
        onChangeFile,
        renderFiles,
        fileInputDisabled,
        onEditPromptSubmit,
        blackThemePopupStyle,
        parameterButtonStyles,
    } = args;

    const [internalShowEditPromptModal, setInternalShowEditPromptModal] = useState(false);
    const [editPromptValue, setEditPromptValue] = useState('');

    const editPromptTextAreaRef = useRef<TextAreaRef | null>(null);
    const modalFileInputRef = useRef<HTMLInputElement>(null);
    const { actions } = useUploadFilesContext();
    const actionsRef = useRef(actions);

    actionsRef.current = actions;

    const showEditPromptModal = controlledShowEditPromptModal ?? internalShowEditPromptModal;
    const setShowEditPromptModal = controlledSetShowEditPromptModal ?? setInternalShowEditPromptModal;

    const prevShowEditPromptModalRef = useRef(showEditPromptModal);

    useEffect(() => {
        const wasEditPromptOpen = prevShowEditPromptModalRef.current;

        prevShowEditPromptModalRef.current = showEditPromptModal;

        if (showEditPromptModal) {
            const maxImageUploads = getModelMaxImageUploads(selectedModel);
            const nextFiles = limitUploadedImages(relatedFiles, maxImageUploads);

            if (nextFiles.length < relatedFiles.length) {
                showErrorToast(getImageUploadLimitMessage(maxImageUploads));
            }

            actions.setFiles(nextFiles);

            return;
        }

        // Clear only on the closing edge, never on mount: this hook shares the upload context with
        // the page composer, and `setFiles([])` revokes the object URL of every file it drops, so
        // an unconditional clear here destroys attachments the user staged before opening the
        // lightbox. `actions` is omitted from the deps because the provider hands back a new
        // identity on every render, which would make the branch above loop.
        if (wasEditPromptOpen) {
            actions.setFiles([]);
        }
    }, [relatedFiles, selectedModel, showEditPromptModal]);

    const showEditPromptModalRef = useRef(showEditPromptModal);

    showEditPromptModalRef.current = showEditPromptModal;

    // Escape closes the whole lightbox, unmounting this hook before the closing edge above can
    // run, which would leave the modal's reference images staged on the page composer and send
    // them out with the next generate.
    useEffect(() => {
        return () => {
            if (showEditPromptModalRef.current) {
                actionsRef.current.setFiles([]);
            }
        };
    }, []);

    useEffect(() => {
        if (showEditPromptModal) {
            setEditPromptValue(currentItem?.ai?.arguments?.prompt ?? '');
        }
    }, [showEditPromptModal, currentItem?.ai?.arguments?.prompt]);

    const openEditPromptModal = () => {
        setEditPromptValue(currentItem?.ai?.arguments?.prompt ?? '');
        if (setDefaultParameters && currentItem?.ai?.arguments && currentItem?.ai?.model_id) {
            const defaultParameters = { ...currentItem.ai.arguments.options };

            delete defaultParameters.prompt;
            setDefaultParameters(defaultParameters, currentItem.ai.model_id);
        }
        setShowEditPromptModal(true);
    };

    const onCloseEditPromptModal = () => {
        setShowEditPromptModal(false);
        if (resetDefaultParameters) {
            resetDefaultParameters();
        }
    };

    const renderEditPromptModal = (props: {
        agent: GalleryAgentType;
        setQuery: (value: string) => void;
        plusOptions: RemixInputPlusOptions;
    }) => {
        const { agent, setQuery: setQueryProp, plusOptions: plusOptionsProp } = props;

        return (
            <EditPromptOverlay
                isOpen={showEditPromptModal}
                onClose={onCloseEditPromptModal}
                parameterSelectPopupStyles={blackThemePopupStyle}
                parameterStepperPopupStyles={blackThemePopupStyle}
                parameterButtonStyles={parameterButtonStyles}
            >
                <PromptInputBox
                    agent={agent}
                    query={editPromptValue}
                    setQuery={setEditPromptValue}
                    fileInputRef={modalFileInputRef}
                    onChangeFile={onChangeFile}
                    renderFiles={renderFiles}
                    fileInputDisabled={fileInputDisabled}
                    onSubmit={() => {
                        const trimmed = editPromptValue.trim();

                        if (trimmed) {
                            setQueryProp(trimmed);
                            onEditPromptSubmit?.(trimmed);
                        }
                        onCloseEditPromptModal();
                    }}
                    textAreaRef={editPromptTextAreaRef}
                    placeholder="Edit prompt..."
                    variant="dark"
                    plusDropdownPopupStyles={blackThemePopupStyle}
                    modelSelectorPopupStyles={`${blackThemePopupStyle} padding: 0; overflow: hidden;`}
                    plusOptions={{
                        ...plusOptionsProp,
                        isNextLine: plusOptionsProp.isNextLine ?? false,
                    }}
                />
            </EditPromptOverlay>
        );
    };

    return {
        showEditPromptModal,
        setShowEditPromptModal,
        openEditPromptModal,
        editPromptValue,
        setEditPromptValue,
        editPromptTextAreaRef,
        renderEditPromptModal,
    };
};
