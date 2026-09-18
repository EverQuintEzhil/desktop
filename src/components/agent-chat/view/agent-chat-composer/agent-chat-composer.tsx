import { useAuiState } from '@assistant-ui/react';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';

import { ComposerQuoteBanner, useSelectionQuoteContext } from '@/components/chat';
import { useChatClassNames, useChatHost } from '@/components/chat-host';
import ComposerFilePreviewList from '@/components/chat/primitives/composer-file-preview-list';
import { usePromptHistoryRecall } from '@/components/chat/primitives/use-prompt-history-recall';
import type { TextAreaRef } from '@/components/text-area';
import { setComposerSpaceId } from '@/lib/local-tools/composer-space-store';
import { useConnectResultNotice } from '@/hooks';
import { useShortcutEnabled } from '@/hooks/keyboard-shortcuts/use-keyboard-shortcuts';
import { useAgentMemories } from '@/hooks/use-agent-memories';
import { filesToAttachments, getUploadedFileIds } from '@/lib/chat/file-attachments';
import { createPastedTextAttachment } from '@/lib/chat/paste-to-file';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';
import { resolveAgentAccessFlags } from '@/utils/resolve-agent-access-flags';
import { extractVariables } from '@/utils/variable-parser';

import { useAgentComposerContext } from '../../context/agent-composer-context';
import { useChatShell } from '../../context/chat-shell-context';
import DeepSearchButton from '../../controls/deep-search-button';
import ModelSelector from '../../controls/model-selector';
import PlusDropdown from '../../controls/plus-dropdown';
import SpaceChipButton from '../../controls/space-chip-button/space-chip-button';
import VariablePopup from '../../controls/variable-popup';
import WebSearchButton from '../../controls/web-search-button';
import useTextWrapDetection from '../../hooks/use-text-wrap-detection';
import useVariableHandling from '../../hooks/use-variable-handling';
import type { HomeSubmitPayload } from '../../types';
import RecommendedCapabilitiesBanner from '../recommended-capabilities-banner';

import { ChatEditor } from './chat-editor';
import type { ChatEditorRef } from './chat-editor';
import { RunningSendControl, SendButton } from './components/composer-send-controls';
import useComposerTriggerSuggestions from './hooks/use-composer-trigger-suggestions';

interface Props {
    agent: ChatAgentType;
    onSubmit: (payload: HomeSubmitPayload) => void;
    value?: string;
    onChange?: (value: string) => void;
    textAreaRef?: RefObject<TextAreaRef | null>;
    autoFocus?: boolean;
    plusDropdownSide?: 'top' | 'bottom';
    showRunningControls?: boolean;
    isSubmitDisabled?: boolean;
    isEditingInProgress?: boolean;
    /**
     * Editing a queued message: the queued update carries only text, so a long paste has to stay
     * inline — as an attachment it would be cleared from the composer and never reach the queue.
     */
    isEditingQueued?: boolean;
    enableHistoryHint?: boolean;
    wrapperClassName?: string;
    /** Enables the "Add to space" picker (new-chat only); gated further by uiConfig.spaces.enabled. */
    enableSpaceSelection?: boolean;
    /**
     * Existing-chat "Add to space" picker: selecting a space moves the current
     * conversation immediately (rather than the new-chat pending selection applied
     * on submit). Still gated by uiConfig.spaces.enabled. Takes precedence over
     * enableSpaceSelection.
     */
    spaceMove?: {
        selectedProjectId?: string | null;
        onMove: (space: { _id: string; name: string } | null) => void;
    };
    /** Renders a static, non-removable space chip (used inside a space's detail page). */
    fixedSpaceName?: string;
}

const AgentChatComposer = ({
    agent,
    onSubmit,
    value,
    onChange,
    textAreaRef: providedTextAreaRef,
    autoFocus = false,
    plusDropdownSide = 'bottom',
    showRunningControls = false,
    isSubmitDisabled = false,
    isEditingInProgress = false,
    isEditingQueued = false,
    enableHistoryHint = false,
    wrapperClassName,
    enableSpaceSelection = false,
    spaceMove,
    fixedSpaceName,
}: Props) => {
    const { composer, filesState } = useAgentComposerContext();
    const shell = useChatShell();
    const { connectors } = composer;
    const quoteContext = useSelectionQuoteContext();
    const hasPendingQuote = Boolean(quoteContext?.pendingQuote);
    const { slots } = useChatHost();
    const classNames = useChatClassNames();
    const spacesUiEnabled = Boolean(agent.uiConfig?.spaces?.enabled);
    // Existing-chat "move to space" takes precedence over the new-chat pending picker.
    const moveSpaceEnabled = Boolean(spaceMove) && spacesUiEnabled;
    const pendingSpaceEnabled = enableSpaceSelection && spacesUiEnabled && !spaceMove;
    const [selectedSpace, setSelectedSpace] = useState<{ _id: string; name: string } | null>(null);

    // Publish the pending selection for the local-tools gating (chat-agent):
    // clientTools must attach to the FIRST message of a new space chat, and the
    // status chip must flip while the user is still typing — submit time is too late.
    useEffect(() => {
        // Only a participating composer writes to the single-slot store: an
        // in-conversation/playground instance publishing null here would clobber
        // a live selection made by the home composer (last writer wins).
        if (!pendingSpaceEnabled) return;

        setComposerSpaceId(selectedSpace?._id ?? null);

        return () => setComposerSpaceId(null);
    }, [pendingSpaceEnabled, selectedSpace]);
    const [localQuery, setLocalQuery] = useState('');
    const [isTextAreaFocused, setIsTextAreaFocused] = useState(false);
    const localEditorRef = useRef<ChatEditorRef>(null);
    const modelSelectorWrapperRef = useRef<HTMLDivElement>(null);
    const query = value || localQuery;

    const setEditorRef = useCallback(
        (node: ChatEditorRef | null) => {
            localEditorRef.current = node;

            if (providedTextAreaRef) providedTextAreaRef.current = node;
        },
        [providedTextAreaRef],
    );

    const editorRefAsTextArea = localEditorRef as RefObject<TextAreaRef | null>;

    useConnectResultNotice(agent.mcpServers);

    const { setConnectorEnabled } = connectors;
    const enableConnector = useCallback(
        (mcpServerId: string) => setConnectorEnabled(mcpServerId, true),
        [setConnectorEnabled],
    );
    const { memories: agentMemories } = useAgentMemories(agent, true);
    const showMemoriesMenu = agentMemories.length > 0;
    const { allowCustomSkills, allowSharedSkills, allowCustomConnectors, allowSharedConnectors } =
        resolveAgentAccessFlags(agent);
    // Counted over the usable set only: a capability the viewer has no access to is filtered
    // out of the submenu itself, so counting it here would open an empty menu.
    const usableAgentSkillCount = (agent.skills ?? []).filter((skill) => skill.noAccess !== true).length;
    const usableAgentConnectorCount = (agent.mcpServers ?? []).filter((server) => server.noAccess !== true).length;
    const showSkillsMenu = usableAgentSkillCount > 0 || allowCustomSkills || allowSharedSkills;
    const showConnectorsMenu = usableAgentConnectorCount > 0 || allowCustomConnectors || allowSharedConnectors;

    // Drop any space selection when switching agents so it can't leak across agents.
    useEffect(() => {
        setSelectedSpace(null);
    }, [agent._id]);
    const { activePopup, hasUnfilledVariables, handleVariablesChange, handleVariableClick, handlePopupClose } =
        useVariableHandling();
    const hasTextWrapped = useTextWrapDetection(editorRefAsTextArea, query);

    // messageCount drives the history hint; the shared recall hook tracks the
    // thread separately and resets its own cursor when the thread changes.
    const messageCount = useAuiState((s) => s.thread.messages.length);

    const showHistoryHint =
        enableHistoryHint && messageCount > 0 && isTextAreaFocused && query.trim().length === 0 && !isEditingInProgress;

    useEffect(() => {
        if (filesState.files.length === 0 && filesState.fileInputRef.current) {
            filesState.fileInputRef.current.value = '';
        }
    }, [filesState.files.length, filesState.fileInputRef]);

    useEffect(() => {
        composer.composerActionsRef.current = {
            openFilePicker: () => filesState.fileInputRef.current?.click(),
            openModelSelector: () =>
                modelSelectorWrapperRef.current?.querySelector<HTMLElement>('[role="combobox"]')?.click(),
        };

        return () => {
            composer.composerActionsRef.current = null;
        };
    }, [composer.composerActionsRef, filesState.fileInputRef]);

    const commitComposerValue = useCallback(
        (nextValue: string) => {
            if (onChange) {
                onChange(nextValue);
            } else {
                setLocalQuery(nextValue);
            }
        },
        [onChange],
    );

    const applyHistoryValue = useCallback(
        (text: string, caret: 'start' | 'end' = 'start') => {
            commitComposerValue(text);
            localEditorRef.current?.changeText(text);

            window.requestAnimationFrame(() => {
                if (caret === 'end') localEditorRef.current?.focusAtEnd();
                else localEditorRef.current?.focusStart();
            });
        },
        [commitComposerValue],
    );

    const isSendEnabled = useShortcutEnabled('send');
    const isRecallEnabled = useShortcutEnabled('recall-messages');

    const historyRecall = usePromptHistoryRecall({
        textAreaRef: editorRefAsTextArea,
        value: query,
        applyValue: applyHistoryValue,
        enabled: isRecallEnabled,
    });

    const handleQueryChange = useCallback(
        (nextValue: string) => {
            historyRecall.notifyValueChange(nextValue);
            commitComposerValue(nextValue);
        },
        [commitComposerValue, historyRecall],
    );

    const { mentionSuggestionBases } = useComposerTriggerSuggestions({
        agent,
        skills: composer.skills,
        connectors,
        customConnectorIds: composer.customConnectorIds,
        sharedConnectorIds: composer.sharedConnectorIds,
    });

    const hasSendableFiles = filesState.files.some((file) => !file.uploadError);

    const canSubmit =
        Boolean(query.trim() || hasPendingQuote || hasSendableFiles) &&
        !filesState.isUploading &&
        !hasUnfilledVariables &&
        !isSubmitDisabled &&
        !isEditingInProgress;

    const isNextLine =
        hasTextWrapped ||
        composer.isWebSearchEnabled ||
        composer.isDeepSearchEnabled ||
        composer.isPublic ||
        composer.availableModels.length > 1 ||
        Object.keys(composer.parameters).length > 0;

    const handleSubmit = useCallback(() => {
        let text = query.trim();

        if (!text && hasSendableFiles && agent.uiConfig?.home?.search?.defaultPrompt) {
            text = agent.uiConfig.home.search.defaultPrompt;
        }

        if (
            (!text && !hasPendingQuote && !hasSendableFiles) ||
            filesState.isUploading ||
            hasUnfilledVariables ||
            isSubmitDisabled
        )
            return;

        const payload: HomeSubmitPayload = {
            message: text,
            attachments: filesToAttachments(filesState.files),
            fileIds: getUploadedFileIds(filesState.files),
            ...(pendingSpaceEnabled && selectedSpace ? { projectId: selectedSpace._id } : {}),
        };

        filesState.clearFiles();
        handleQueryChange('');
        localEditorRef.current?.changeText('');
        setSelectedSpace(null);
        onSubmit(payload);
    }, [
        query,
        filesState,
        hasSendableFiles,
        agent,
        hasPendingQuote,
        hasUnfilledVariables,
        isSubmitDisabled,
        handleQueryChange,
        onSubmit,
        pendingSpaceEnabled,
        selectedSpace,
    ]);

    // Not memoised: it reads `filesState.files` on every call, and a stale copy
    // would reuse a name already taken by an attachment.
    const handlePasteText = (text: string): boolean => {
        if (isEditingQueued) return false;

        const file = createPastedTextAttachment({
            text,
            isAttachmentEnabled: Boolean(agent.uiConfig?.home?.search?.files),
            accept: agent.uiConfig?.home?.search?.accept,
            existingNames: filesState.files.map((f) => f.name),
        });

        if (!file) return false;

        filesState.addFiles([file]);

        return true;
    };

    const handleTextAreaBlur = () => {
        setIsTextAreaFocused(false);
    };

    const getPlaceholderText = () => {
        if (isEditingInProgress) return 'Finish editing the message above to continue';
        if (showHistoryHint) return 'Use ↑ ↓ to browse recent messages';

        return agent.uiConfig?.home?.search?.placeholder || 'Ask anything';
    };

    const renderSendControl = () => {
        if (!showRunningControls) {
            return <SendButton canSubmit={canSubmit} onSubmit={handleSubmit} />;
        }

        return <RunningSendControl canSubmit={canSubmit} onSubmit={handleSubmit} />;
    };

    const getSpacesMenuProps = () => {
        if (moveSpaceEnabled) {
            return {
                agentId: agent._id,
                selectedProjectId: spaceMove!.selectedProjectId ?? undefined,
                label: spaceMove!.selectedProjectId ? 'Change space' : 'Add to space',
                onSelect: spaceMove!.onMove,
            };
        }

        if (pendingSpaceEnabled) {
            return {
                agentId: agent._id,
                selectedProjectId: selectedSpace?._id,
                onSelect: setSelectedSpace,
            };
        }

        return undefined;
    };

    const renderPlusDropdown = () => {
        const spaces = getSpacesMenuProps();
        const hasPlusContent =
            composer.plusDropdownOptions.length > 0 ||
            Boolean(spaces) ||
            showMemoriesMenu ||
            showSkillsMenu ||
            showConnectorsMenu;

        if (!hasPlusContent) {
            return null;
        }

        return (
            <PlusDropdown
                isOpen={composer.showPlusDropdown}
                onToggle={() => composer.setShowPlusDropdown(!composer.showPlusDropdown)}
                onClose={() => composer.setShowPlusDropdown(false)}
                onSelect={composer.handlePlusDropdownSelect}
                options={composer.plusDropdownOptions}
                side={plusDropdownSide}
                align="start"
                connectors={
                    showConnectorsMenu
                        ? {
                              connections: connectors.connections,
                              isLoading: connectors.isLoading,
                              disabledMap: connectors.disabledMap,
                              customIds: composer.customConnectorIds,
                              sharedIds: composer.sharedConnectorIds,
                              nonOauthConnectors: connectors.nonOauthConnectors,
                              disconnectedConnectors: connectors.disconnectedConnectors,
                              onToggle: connectors.toggleMcpServer,
                              renderManageAction: slots?.renderManageConnectorsLink,
                              onReconnect: connectors.reconnect,
                              onToggleDisconnected: (mcpServerId: string) => {
                                  void connectors.toggleDisconnectedConnector(mcpServerId);
                              },
                              connectingId: connectors.connectingId,
                              enablingId: connectors.enablingId,
                              onCancel: connectors.cancelConnection,
                              cancellingId: connectors.cancellingId,
                          }
                        : undefined
                }
                skills={
                    showSkillsMenu
                        ? {
                              skills: composer.skills.skills,
                              enabledIds: composer.skills.enabledIds,
                              customIds: composer.skills.customIds,
                              sharedIds: composer.skills.sharedIds,
                              onToggle: composer.skills.toggleSkill,
                              onManage: slots?.onManageSkills,
                          }
                        : undefined
                }
                memories={
                    showMemoriesMenu
                        ? {
                              agent,
                              onManage: slots?.onManageMemories,
                          }
                        : undefined
                }
                spaces={spaces}
            />
        );
    };

    const composerContent = (
        <>
            <input
                ref={filesState.fileInputRef}
                className="file-upload hidden"
                accept={agent.uiConfig?.home?.search?.accept || ''}
                multiple
                onChange={filesState.onChangeFile}
                type="file"
                disabled={filesState.isUploading}
                aria-hidden
            />

            <div className="composer-stack flex w-full flex-col">
                <RecommendedCapabilitiesBanner
                    agentId={agent._id}
                    mcpServers={agent.mcpServers ?? []}
                    disabledMap={connectors.disabledMap}
                    connectingId={connectors.connectingId}
                    enablingId={connectors.enablingId}
                    onConnect={connectors.reconnect}
                    onEnable={enableConnector}
                    disabledSkills={composer.skills.disabledAgentSkills}
                    onEnableSkill={composer.skills.enableSkill}
                    capabilities={agent}
                />
                <div
                    className={`chat-block chat-composer-block flex flex-wrap items-center px-4 ${isNextLine ? 'next-line' : 'gap-2'}`}
                >
                    <ComposerFilePreviewList
                        files={filesState.files}
                        fileInputRef={filesState.fileInputRef}
                        onRemove={(index) => filesState.setFiles(filesState.files.filter((_, i) => i !== index))}
                        onRetry={filesState.retryUpload}
                    />

                    <ComposerQuoteBanner />

                    <div className={cn('chat-composer-input-wrap', classNames.composerInput)}>
                        <ChatEditor
                            ref={setEditorRef}
                            placeholder={getPlaceholderText()}
                            value={query}
                            onChange={handleQueryChange}
                            onPasteText={handlePasteText}
                            autoFocus={autoFocus}
                            disabled={isEditingInProgress}
                            onVariablesChange={handleVariablesChange}
                            onVariableClick={handleVariableClick}
                            variableTooltip="Click to fill in this variable"
                            mentionItems={mentionSuggestionBases}
                            commandOptions={composer.plusDropdownOptions}
                            onCommandSelect={composer.handlePlusDropdownSelect}
                            onFocus={() => setIsTextAreaFocused(true)}
                            onBlur={handleTextAreaBlur}
                            onEnter={() => {
                                if (!isSendEnabled) return false;
                                handleSubmit();

                                return true;
                            }}
                            onEscape={() => {
                                if (hasPendingQuote && !query.trim()) {
                                    quoteContext?.clearPendingQuote();

                                    return true;
                                }

                                return shell.onEscape?.() ?? false;
                            }}
                            onKeyDown={(e) => {
                                if (e.defaultPrevented) return;

                                historyRecall.handleKeyDown(e);
                            }}
                        />
                    </div>

                    <div className="chat-options flex flex-wrap items-center justify-start gap-2">
                        {renderPlusDropdown()}
                        <WebSearchButton
                            isEnabled={composer.isWebSearchEnabled}
                            onToggle={() => composer.setIsWebSearchEnabled(!composer.isWebSearchEnabled)}
                        />
                        <DeepSearchButton
                            isEnabled={composer.isDeepSearchEnabled}
                            onToggle={() => composer.setIsDeepSearchEnabled(false)}
                        />
                        {pendingSpaceEnabled && selectedSpace && (
                            <SpaceChipButton name={selectedSpace.name} onRemove={() => setSelectedSpace(null)} />
                        )}
                        {fixedSpaceName && <SpaceChipButton name={fixedSpaceName} />}
                        <div ref={modelSelectorWrapperRef} className="contents">
                            <ModelSelector
                                selectedModel={composer.model}
                                availableModels={composer.availableModels}
                                onSelect={composer.setModel}
                            />
                        </div>

                        {composer.renderSelectedParameters()}
                    </div>

                    {renderSendControl()}
                </div>
            </div>

            {activePopup !== null && (
                <VariablePopup
                    isOpen={true}
                    variableName={activePopup.variableName}
                    position={activePopup.position}
                    onClose={handlePopupClose}
                    onSave={(nextValue: string) => {
                        localEditorRef.current?.replaceVariable(activePopup.variableName, nextValue);
                        const text = localEditorRef.current?.getText() ?? '';

                        handleQueryChange(text);
                        handleVariablesChange(extractVariables(text));
                        handlePopupClose();
                    }}
                />
            )}
        </>
    );

    const mergedWrapperClassName = cn(wrapperClassName, classNames.composer);

    if (!mergedWrapperClassName) return composerContent;

    return <div className={mergedWrapperClassName}>{composerContent}</div>;
};

export default AgentChatComposer;
