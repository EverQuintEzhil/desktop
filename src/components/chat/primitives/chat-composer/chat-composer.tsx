import { ComposerPrimitive } from '@assistant-ui/react';
import { ArrowUpIcon, PaperclipIcon, SquareIcon } from 'lucide-react';
import { useCallback, useRef, type KeyboardEvent, type ReactNode } from 'react';

import {
    ChatEditor,
    type ChatEditorRef,
    type MentionItemsProvider,
} from '@/components/agent-chat/view/agent-chat-composer/chat-editor';
import { TooltipIconButton } from '@/components/assistant-ui/tooltip-icon-button';
import type { TextAreaRef } from '@/components/text-area';
import type { DirectiveSuggestionBase } from '@/lib/chat/directives';
import { cn } from '@/lib/utils';
import type { FileType } from '@/types/chat';
import type { VariableInfo } from '@/utils/variable-parser';

import ComposerFilePreviewList from '../composer-file-preview-list';
import { usePromptHistoryRecall } from '../use-prompt-history-recall';

import './chat-composer.scss';

const DEFAULT_FILE_ACCEPT = 'image/*,.pdf,.doc,.docx,.txt';
const DEFAULT_PLACEHOLDER = 'Send a message...';
const NO_MENTION_ITEMS: DirectiveSuggestionBase[] = [];

interface ChatComposerProps {
    value: string;
    onChange: (text: string) => void;
    onSubmit: (text: string) => void;
    files: FileType[];
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onChangeFile: (event: React.ChangeEvent<HTMLInputElement>) => void;
    onRemoveFile: (index: number) => void;
    onRetryFile?: (tempId: string) => void;
    isUploading?: boolean;
    accept?: string;
    placeholder?: string;
    /** Gates sending; the editor stays writable so a draft can be typed while a run streams. */
    disabled?: boolean;
    autoFocus?: boolean;
    isRunning?: boolean;
    showAttachButton?: boolean;
    toolbar?: ReactNode;
    overlay?: ReactNode;
    wrapperClassName?: string;
    onKeyDown?: (event: KeyboardEvent) => void;
    enableHistoryRecall?: boolean;
    mentionItems?: DirectiveSuggestionBase[];
    mentionEmptyLabel?: string;
    /** Server-searched alternative to `mentionItems`, read once at mount. */
    mentionItemsProvider?: MentionItemsProvider;
    /** Defaults to whether a mention source was given at mount; set it when `mentionItems` fills in later. */
    mentionsEnabled?: boolean;
    onPasteText?: (text: string) => boolean;
    onVariablesChange?: (variables: VariableInfo[]) => void;
    onVariableClick?: (variableName: string, position: { x: number; y: number }) => void;
    variableTooltip?: string;
}

const ChatComposer = ({
    value,
    onChange,
    onSubmit,
    files,
    fileInputRef,
    onChangeFile,
    onRemoveFile,
    onRetryFile,
    isUploading = false,
    accept = DEFAULT_FILE_ACCEPT,
    placeholder = DEFAULT_PLACEHOLDER,
    disabled = false,
    autoFocus = true,
    isRunning = false,
    showAttachButton = true,
    toolbar,
    overlay,
    wrapperClassName,
    onKeyDown,
    enableHistoryRecall = false,
    mentionItems = NO_MENTION_ITEMS,
    mentionEmptyLabel,
    mentionItemsProvider,
    mentionsEnabled,
    onPasteText,
    onVariablesChange,
    onVariableClick,
    variableTooltip,
}: ChatComposerProps) => {
    // Decided at mount: with no mention source, "@" must stay plain text rather than open an empty menu.
    const hasMentionSource = useRef(
        mentionsEnabled ?? (Boolean(mentionItemsProvider) || mentionItems.length > 0),
    ).current;
    const editorRef = useRef<ChatEditorRef>(null);
    const editorRefAsTextArea = editorRef as React.RefObject<TextAreaRef | null>;

    const historyRecall = usePromptHistoryRecall({
        textAreaRef: editorRefAsTextArea,
        value,
        enabled: enableHistoryRecall,
        applyValue: useCallback(
            (text: string, caret: 'start' | 'end') => {
                onChange(text);
                editorRef.current?.changeText(text);

                window.requestAnimationFrame(() => {
                    if (caret === 'end') editorRef.current?.focusAtEnd();
                    else editorRef.current?.focusStart();
                });
            },
            [onChange],
        ),
    });

    const handleChange = (text: string) => {
        historyRecall.notifyValueChange(text);
        onChange(text);
    };

    const handleSend = useCallback(() => {
        // The host may only mirror `value` back a render later, and Enter can land in that gap.
        const text = (editorRef.current?.getText() ?? value).trim();

        if ((!text && files.length === 0) || isUploading || disabled || isRunning) return;

        onSubmit(text);
        onChange('');
        editorRef.current?.changeText('');
    }, [value, files.length, isUploading, disabled, isRunning, onSubmit, onChange]);

    const handleKeyDown = (event: KeyboardEvent) => {
        onKeyDown?.(event);

        if (event.defaultPrevented) return;

        historyRecall.handleKeyDown(event);
    };

    const openFilePicker = () => {
        fileInputRef.current?.click();
    };

    const canSend = (value.trim().length > 0 || files.length > 0) && !isUploading && !disabled && !isRunning;

    const renderPrimaryAction = () => {
        if (isRunning) {
            return (
                <ComposerPrimitive.Cancel asChild>
                    <TooltipIconButton
                        tooltip="Stop generating"
                        side="bottom"
                        type="button"
                        variant="outline"
                        size="icon"
                        className="aui-composer-cancel size-8 rounded-full"
                        aria-label="Stop generating"
                    >
                        <SquareIcon className="aui-composer-cancel-icon size-3 fill-current" />
                    </TooltipIconButton>
                </ComposerPrimitive.Cancel>
            );
        }

        return (
            <TooltipIconButton
                tooltip="Send message"
                side="bottom"
                type="button"
                variant="outline"
                size="icon"
                className="aui-composer-send size-8 rounded-full"
                aria-label="Send message"
                disabled={!canSend}
                onClick={handleSend}
            >
                <ArrowUpIcon className="aui-composer-send-icon size-4" />
            </TooltipIconButton>
        );
    };

    return (
        <ComposerPrimitive.Root className="aui-composer-root relative flex w-full flex-col">
            <div
                data-slot="aui_composer-shell"
                className={cn(
                    'flex w-full flex-col gap-2 rounded-(--composer-radius) border bg-card p-(--composer-padding) shadow-surface transition-shadow',
                    wrapperClassName,
                )}
            >
                {overlay}

                <input
                    ref={fileInputRef}
                    type="file"
                    className="hidden"
                    accept={accept}
                    multiple
                    onChange={onChangeFile}
                    disabled={isUploading}
                    aria-hidden
                />

                <ComposerFilePreviewList
                    files={files}
                    fileInputRef={fileInputRef}
                    onRemove={onRemoveFile}
                    onRetry={onRetryFile}
                />

                <ChatEditor
                    ref={editorRef}
                    className="aui-composer-input w-full"
                    placeholder={placeholder}
                    value={value}
                    autoFocus={autoFocus}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    onPasteText={onPasteText}
                    onEnter={() => {
                        handleSend();

                        return true;
                    }}
                    mentionsEnabled={hasMentionSource}
                    mentionItems={mentionItems}
                    mentionEmptyLabel={mentionEmptyLabel}
                    mentionItemsProvider={mentionItemsProvider}
                    onVariablesChange={onVariablesChange}
                    onVariableClick={onVariableClick}
                    variableTooltip={variableTooltip}
                />

                <div className="aui-composer-action-wrapper relative flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        {showAttachButton !== false ? (
                            <TooltipIconButton
                                tooltip="Add attachment"
                                side="bottom"
                                type="button"
                                variant="outline"
                                size="icon"
                                className="aui-composer-add-attachment size-8 rounded-full"
                                aria-label="Attach files"
                                disabled={isUploading}
                                onClick={openFilePicker}
                            >
                                <PaperclipIcon className="size-4" />
                            </TooltipIconButton>
                        ) : null}

                        {toolbar}
                    </div>

                    {renderPrimaryAction()}
                </div>
            </div>
        </ComposerPrimitive.Root>
    );
};

ChatComposer.displayName = 'ChatComposer';

export default ChatComposer;
export type { ChatComposerProps };
