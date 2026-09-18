import { HatGlassesIcon } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';

import { useChatClassNames, useChatHost } from '@/components/chat-host';
import Dropzone from '@/components/dropzone';
import type { TextAreaRef } from '@/components/text-area';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';
import type { ChatAgentType } from '@/types/admin';
import type { FileType } from '@/types/chat';

import { useAgentComposerContext } from '../../context/agent-composer-context';
import { useChatShell } from '../../context/chat-shell-context';
import type { HomeSubmitPayload } from '../../types';
import ChatComposer from '../agent-chat-composer';
import ChatHomeApp from '../chat-home-app';
import PreviewBackButton from '../preview-back-button';

import './home.scss';

interface Props {
    agent: ChatAgentType;
    isFromAdmin?: boolean;
    initialPrompt?: string;
    initialFiles?: FileType[];
    /** Changes when the host navigates to a fresh home, forcing a params/files reset. */
    resetKey?: string | number;
    /** Set on the fallback render to skip the home-app branch and show the welcome screen. */
    skipHomeApp?: boolean;
    onSubmit: (payload: HomeSubmitPayload) => void;
}

const ChatHome = ({
    agent,
    isFromAdmin = false,
    initialPrompt,
    initialFiles,
    resetKey,
    skipHomeApp = false,
    onSubmit,
}: Props) => {
    const [query, setQuery] = useState(initialPrompt || '');
    const textAreaRef = useRef<TextAreaRef>(null);

    const { composer, filesState } = useAgentComposerContext();
    const { setParameters } = composer;
    const { clearFiles, setFiles } = filesState;
    const { isPreview, variant } = useChatShell();
    // The assistant panel is 340-640px wide however wide the window is, so the viewport
    // breakpoints below never fire there: the panel lays out as a scrolling narrow column.
    const isPanel = variant === 'panel';
    const fillParent = isFromAdmin || isPanel;
    const { slots } = useChatHost();
    const classNames = useChatClassNames();
    const launcher = slots?.useAgentLauncher?.(agent) ?? {};

    const homeApp = agent.uiConfig?.home?.homeApp;
    const showHomeApp = !skipHomeApp && Boolean(homeApp?.refName) && homeApp?.enabled !== false;

    useEffect(() => {
        setParameters({});

        if (initialFiles?.length) {
            setFiles(initialFiles);
        } else {
            clearFiles();
        }
    }, [setParameters, clearFiles, setFiles, resetKey]);

    const renderHeaderCluster = () => {
        const headerActions = slots?.renderHomeHeaderActions?.({ agent });
        const isIncognitoEnabled = agent.uiConfig?.home?.search?.isIncognitoEnabled;

        if (!headerActions && !isIncognitoEnabled) {
            return null;
        }

        return (
            <div className="home-header-actions absolute top-2 right-4 z-2 flex items-center gap-2">
                {headerActions}
                {isIncognitoEnabled && (
                    <SimpleTooltip
                        content={composer.isIncognitoMode ? 'Turn off Temporary chat' : 'Turn on Temporary chat'}
                        side="bottom"
                    >
                        <div
                            className={`incognito-button flex items-center justify-center ${composer.isIncognitoMode ? 'active' : ''}`}
                            onClick={composer.toggleIncognitoMode}
                            onKeyDown={(e) => e.key === 'Enter' && composer.toggleIncognitoMode()}
                            role="button"
                            tabIndex={0}
                        >
                            <HatGlassesIcon className="size-5" />
                        </div>
                    </SimpleTooltip>
                )}
            </div>
        );
    };

    const renderComposer = () => {
        if (slots?.renderComposer) {
            return slots.renderComposer({
                send: (message) => onSubmit({ message }),
                isRunning: false,
                isDisabled: false,
            });
        }

        return (
            <ChatComposer
                agent={agent}
                onSubmit={onSubmit}
                value={query}
                onChange={setQuery}
                textAreaRef={textAreaRef}
                autoFocus
                enableSpaceSelection
            />
        );
    };

    const applyQuestion = (question: string) => {
        setQuery(question);
        textAreaRef.current?.changeText(question);
        textAreaRef.current?.focus();
    };

    const renderTitle = () => (
        <h2 className={cn('text-center text-3xl font-medium', !isPanel && 'my-auto')}>
            {composer.isIncognitoMode
                ? agent.uiConfig?.home?.titleIncognito || 'You are in Temporary chat mode'
                : agent.uiConfig?.home?.title || 'What can I help you with?'}
        </h2>
    );

    // The panel follows the mobile layout: title and starter questions share the centre and the
    // chat box sits at the bottom, so the questions render before it there and after it elsewhere.
    const renderQuestions = () => {
        const questions = agent.uiConfig?.home?.questions;

        if (!Array.isArray(questions) || questions.length === 0) return null;

        return (
            <ul className="question-grid grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-4 max-lg:hidden">
                {questions.map((question) => (
                    <li
                        className="question-card p-4"
                        key={question}
                        role="button"
                        tabIndex={0}
                        onClick={() => applyQuestion(question)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' || e.key === ' ') {
                                e.preventDefault();
                                applyQuestion(question);
                            }
                        }}
                    >
                        <span className={cn('text-sm font-medium', !isPanel && 'line-clamp-2')}>{question}</span>
                    </li>
                ))}
            </ul>
        );
    };

    /**
     * The panel is a narrow column of fixed height, so the chat box and the disclaimer are pinned
     * and only the title and starter questions scroll. Otherwise a chat box grown by a long draft
     * would push its own send controls out of view.
     */
    const renderPanelHome = () => (
        <div className="mx-auto flex h-full w-full max-w-[810px] flex-col gap-5 overflow-hidden px-4">
            <div className="scrollbar-controller scrollbar-vertical flex min-h-0 flex-1 flex-col">
                {/* Auto margins centre this block while it fits and let it scroll from its true top
                    once it does not; `justify-center` on the scroll container would put the top
                    outside the scrollable overflow region, where no scrolling can reach it. */}
                <div className="my-auto flex flex-col gap-5">
                    {renderTitle()}
                    {renderQuestions()}
                </div>
            </div>
            <div className="shrink-0">{renderComposer()}</div>
        </div>
    );

    const renderDefaultHome = () => (
        <div
            className={cn(
                'mx-auto flex w-full max-w-[810px] flex-col gap-12 px-4 max-lg:flex max-lg:h-full max-lg:gap-5',
                'max-lg:items-center max-lg:justify-center',
                // In preview (builder), reserve the 72px bottom-tab space so the composer isn't
                // clipped by the mobile Chat/Configure tab bar.
                isPreview ? 'max-lg:min-h-[calc(100svh-49px-72px)]' : 'max-lg:min-h-[calc(100svh-49px)]',
            )}
        >
            {renderTitle()}
            {renderComposer()}
            {renderQuestions()}
        </div>
    );

    if (slots?.renderEmptyState) {
        return <>{slots.renderEmptyState()}</>;
    }

    if (showHomeApp) {
        return (
            <ChatHomeApp
                agent={agent}
                isFromAdmin={isFromAdmin}
                resetKey={resetKey}
                onSubmit={onSubmit}
                renderFallback={() => (
                    <ChatHome
                        agent={agent}
                        isFromAdmin={isFromAdmin}
                        initialPrompt={initialPrompt}
                        initialFiles={initialFiles}
                        resetKey={resetKey}
                        skipHomeApp
                        onSubmit={onSubmit}
                    />
                )}
            />
        );
    }

    return (
        <>
            <Dropzone
                multiple
                global
                accept={agent.uiConfig?.home?.search?.accept || ''}
                onChange={filesState.onChangeFile}
                uploading={filesState.isUploading}
                disabled={!agent.uiConfig?.home?.search?.files}
                className={'h-full w-full min-w-0'}
            >
                <div
                    className={cn(
                        'home-screen chat-home flex w-full flex-col items-center justify-center pb-4 max-lg:h-auto max-lg:p-0',
                        // The header title and actions are absolutely positioned over the column, so
                        // its content has to start below them rather than under them.
                        isPanel ? 'overflow-hidden pt-14' : 'pt-4 lg:flex-row',
                        fillParent ? 'h-full' : 'h-svh',
                        classNames.emptyState,
                    )}
                >
                    <div className="header-title flex items-center gap-2">
                        <PreviewBackButton />
                        {/* The assistant panel's chrome row above carries the agent identity, so
                            repeating it here shows the name twice on the panel's home screen. */}
                        {!isPanel && (
                            <>
                                <h2 className="brand-name flex font-bold">{launcher.launcherName}</h2>
                                {launcher.renderInfoIcon && (
                                    <SimpleTooltip content="Info" side="bottom">
                                        {launcher.renderInfoIcon()}
                                    </SimpleTooltip>
                                )}
                            </>
                        )}
                    </div>

                    {renderHeaderCluster()}

                    {isPanel ? renderPanelHome() : renderDefaultHome()}

                    {slots?.renderFooter?.() ?? null}
                </div>
                {launcher.renderAgentDetailsSidesheet?.()}
            </Dropzone>
            {slots?.renderHomeSidePanel?.({ agent })}
        </>
    );
};

export default ChatHome;
