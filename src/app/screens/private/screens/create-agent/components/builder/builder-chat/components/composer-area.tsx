import { useAuiState } from '@assistant-ui/react';
import type { FC } from 'react';

import ModelSelector from '@/components/agent-chat/controls/model-selector';
import ChatComposer from '@/components/chat/primitives/chat-composer';
import { useAuiComposerBinding } from '@/components/chat/primitives/use-aui-composer-binding';
import type { DropDownValueObject } from '@/components/ui/dropdown-menu';
import type { useChatFiles } from '@/lib/chat/use-chat-files';
import type { ModelValueType } from '@/types/admin';

import { FILE_ACCEPT } from '../constants';
import { useBuilderMentionItemsProvider } from '../use-builder-mention-items';

export interface ComposerAreaProps {
    files: ReturnType<typeof useChatFiles>['files'];
    fileInputRef: ReturnType<typeof useChatFiles>['fileInputRef'];
    isUploading: boolean;
    onChangeFile: ReturnType<typeof useChatFiles>['onChangeFile'];
    onRemoveFile: (index: number) => void;
    onRetryFile: ReturnType<typeof useChatFiles>['retryUpload'];
    onSubmit: (text: string) => void;
    availableModels: DropDownValueObject<ModelValueType>[];
    selectedModel: DropDownValueObject<ModelValueType> | null;
    onSelectModel: (model: DropDownValueObject<ModelValueType> | null) => void;
}

const ComposerArea: FC<ComposerAreaProps> = ({
    files,
    fileInputRef,
    isUploading,
    onChangeFile,
    onRemoveFile,
    onRetryFile,
    onSubmit,
    availableModels,
    selectedModel,
    onSelectModel,
}) => {
    const { value, onChange } = useAuiComposerBinding();
    const isRunning = useAuiState((s) => s.thread.isRunning);
    const mentionItemsProvider = useBuilderMentionItemsProvider();

    return (
        <div className="builder-chat-composer shrink-0 border-t border-border bg-background p-4">
            <ChatComposer
                value={value}
                onChange={onChange}
                files={files}
                fileInputRef={fileInputRef}
                onChangeFile={onChangeFile}
                onRemoveFile={onRemoveFile}
                onRetryFile={onRetryFile}
                isUploading={isUploading}
                accept={FILE_ACCEPT}
                placeholder="Ask anything, @ for context"
                onSubmit={onSubmit}
                disabled={isRunning}
                isRunning={isRunning}
                enableHistoryRecall
                mentionItemsProvider={mentionItemsProvider}
                toolbar={
                    <ModelSelector
                        selectedModel={selectedModel}
                        availableModels={availableModels}
                        onSelect={onSelectModel}
                    />
                }
            />
        </div>
    );
};

export default ComposerArea;
