import { useMemo, useRef, useState } from 'react';

import { useAppSelector, useTextWrapDetection, useUploadFileRenders, useUploadFiles } from '@/app/hooks';
import type { TextAreaRef } from '@/components/text-area';
import { type DropDownValueObject } from '@/components/ui/dropdown-menu';
import { useUploadFilesContext } from '@/context';
import { selectUser } from '@/store/selectors';
import type { ModelValueType } from '@/types/admin';

import { getGalleryParamsStorageKey } from '../../utils/gallery-params-persistence';
import { getModelMaxImageUploads } from '../../utils/model-image-upload-limit';

import type { Props } from './types';
import { useGalleryImageUploads } from './use-gallery-image-uploads';
import { useGalleryParamsSync } from './use-gallery-params-sync';
import { useModelParameterState } from './use-model-parameter-state';
import { useParameterPlusOptions } from './use-parameter-plus-options';

const useGalleryPromptOptions = (props: Props) => {
    const { agent, initialPrompt, initialIsPublic } = props;

    const [query, setQuery] = useState(initialPrompt || '');
    const [isPublic, setIsPublic] = useState(initialIsPublic ?? agent.uiConfig?.isPublic ?? false);
    const [activeTextboxParameterKey, setActiveTextboxParameterKey] = useState<string | null>(null);
    const textAreaRef = useRef<TextAreaRef>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { state: uploadFiles, actions: uploadFileActions } = useUploadFilesContext();
    const { onChangeFile: uploadFilesOnChange, retryUpload } = useUploadFiles(agent, 'gallery');
    const { renderFiles } = useUploadFileRenders({ fileInputRef, retryUpload });
    const hasTextWrapped = useTextWrapDetection(textAreaRef, query);
    const showPublicPrivateToggle = agent.uiConfig?.showPublicPrivateToggle || false;

    const availableModels = useMemo<DropDownValueObject<ModelValueType>[]>(
        () => (agent.uiConfig.models ?? []).map((model) => ({ label: model.name, value: model })),
        [agent.uiConfig.models],
    );

    const initialSelectedModel = useMemo<DropDownValueObject<ModelValueType> | null>(() => {
        const defaultModel = agent.uiConfig.defaultModel;

        if (defaultModel) {
            const fromList = availableModels.find((m) => m.value.modelId === defaultModel.modelId);

            if (fromList) return fromList;

            return { label: defaultModel.name, value: defaultModel };
        }

        return availableModels[0] ?? null;
    }, [agent.uiConfig.defaultModel, availableModels]);

    const agentRef = useRef(agent);

    agentRef.current = agent;

    const clearActiveTextboxParameterKey = (key: string) => {
        setActiveTextboxParameterKey((currentKey) => (currentKey === key ? null : currentKey));
    };

    const {
        modelParamState,
        dispatch,
        setParameter,
        removeParameter,
        setSelectedModel,
        setDefaultParameters,
        resetDefaultParameters,
        mergedParametersRef,
        stateRef,
        skipNextSyncRef,
    } = useModelParameterState({
        agent,
        agentRef,
        availableModels,
        initialSelectedModel,
        clearActiveTextboxParameterKey,
    });

    const { selectedModel, parameters } = modelParamState;
    const maxImageUploads = getModelMaxImageUploads(selectedModel?.value);

    const user = useAppSelector(selectUser);
    const storageKey = getGalleryParamsStorageKey(user._id ?? '', agent._id);

    useGalleryParamsSync({
        agentRef,
        availableModels,
        storageKey,
        modelParamState,
        dispatch,
        stateRef,
        skipNextSyncRef,
        mergedParametersRef,
    });

    const { onChangeFile, getAddPhotoOption } = useGalleryImageUploads({
        maxImageUploads,
        uploadFiles,
        uploadFileActions,
        uploadFilesOnChange,
    });

    const { plusDropdownOptions, handlePlusDropdownSelect, renderSelectedParameters } = useParameterPlusOptions({
        agent,
        selectedModel,
        parameters,
        setParameter,
        removeParameter,
        activeTextboxParameterKey,
        setActiveTextboxParameterKey,
    });

    const isNextLine = useMemo(() => {
        return hasTextWrapped || isPublic || availableModels.length > 1 || Object.keys(parameters).length > 0;
    }, [hasTextWrapped, isPublic, parameters, availableModels.length]);

    return {
        query,
        setQuery,
        textAreaRef,
        fileInputRef,
        renderFiles,
        onChangeFile,
        plusDropdownOptions,
        getAddPhotoOption,
        handlePlusDropdownSelect,
        parameters,
        setDefaultParameters,
        resetDefaultParameters,
        renderSelectedParameters,
        selectedModel,
        availableModels,
        setSelectedModel,
        isPublic,
        setIsPublic,
        showPublicPrivateToggle,
        isNextLine,
    };
};

export default useGalleryPromptOptions;
