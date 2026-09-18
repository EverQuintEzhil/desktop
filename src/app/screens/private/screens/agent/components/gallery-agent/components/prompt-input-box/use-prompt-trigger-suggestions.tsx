import type { LucideIcon } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CSSProperties, KeyboardEvent, RefObject } from 'react';

import type { TextAreaRef } from '@/components/text-area';
import {
    buildDirectiveSuggestions,
    formatDirectiveText,
    getSerializedTextOffset,
    getSerializedTextPosition,
    serializeDirectiveEditableText,
    setSerializedTextOffset,
} from '@/lib/chat/directives';
import type { DirectiveSuggestionBase } from '@/lib/chat/directives';
import type { GalleryAgentType } from '@/types/admin';
import type { PlusDropdownOption } from '@/types/chat';

type PromptTriggerType = 'mention' | 'command';

interface PromptTriggerState {
    type: PromptTriggerType;
    query: string;
    start: number;
    end: number;
    position?: CSSProperties;
}

interface PromptSuggestion {
    id: string;
    label: string;
    description?: string;
    icon: LucideIcon;
    onSelect: () => void;
}

interface UsePromptTriggerSuggestionsOptions {
    agent: GalleryAgentType;
    query: string;
    setQuery: (query: string) => void;
    textAreaRef: RefObject<TextAreaRef | null>;
    plusDropdownOptions: PlusDropdownOption[];
    handlePlusDropdownSelect: (option: PlusDropdownOption) => void;
    onCommandSelect: () => void;
}

const MAX_TRIGGER_ITEMS = 7;
const TRIGGER_COMMAND_MAX_WIDTH = 216;
const TRIGGER_COMMAND_VIEWPORT_MARGIN = 40;

export const usePromptTriggerSuggestions = (options: UsePromptTriggerSuggestionsOptions) => {
    const { agent, query, setQuery, textAreaRef, plusDropdownOptions, handlePlusDropdownSelect, onCommandSelect } =
        options;

    const [triggerState, setTriggerState] = useState<PromptTriggerState | null>(null);
    const [highlightedSuggestionIndex, setHighlightedSuggestionIndex] = useState(0);

    const getTextOffset = useCallback((element: HTMLElement): number | null => {
        return getSerializedTextOffset(element);
    }, []);

    const setTextOffset = useCallback((element: HTMLElement, offset: number): boolean => {
        return setSerializedTextOffset(element, offset);
    }, []);

    const getTextPosition = useCallback(
        (element: HTMLElement, offset: number): { node: Node; offset: number } | null => {
            return getSerializedTextPosition(element, offset);
        },
        [],
    );

    const getTextAnchorRect = useCallback(
        (element: HTMLElement, offset: number): DOMRect | null => {
            const startPosition = getTextPosition(element, offset);
            const endPosition = getTextPosition(element, offset + 1) || startPosition;

            if (!startPosition || !endPosition) return null;

            try {
                const range = document.createRange();

                range.setStart(startPosition.node, startPosition.offset);
                range.setEnd(endPosition.node, endPosition.offset);

                return range.getClientRects()[0] || range.getBoundingClientRect();
            } catch {
                return null;
            }
        },
        [getTextPosition],
    );

    const getTriggerCommandPosition = useCallback(
        (element: HTMLElement, triggerStart: number): CSSProperties | undefined => {
            const anchorRect = getTextAnchorRect(element, triggerStart);
            const wrapper = element.closest('.chat-composer-input-wrap') as HTMLElement | null;

            if (!anchorRect || !wrapper) return undefined;

            const wrapperRect = wrapper.getBoundingClientRect();
            const popupMaxWidth = Math.min(
                TRIGGER_COMMAND_MAX_WIDTH,
                window.innerWidth - TRIGGER_COMMAND_VIEWPORT_MARGIN,
            );
            const maxLeft = Math.max(wrapperRect.width - popupMaxWidth, 0);
            const left = Math.min(Math.max(anchorRect.left - wrapperRect.left, 0), maxLeft);
            const bottom = Math.max(wrapperRect.bottom - anchorRect.top + 8, 8);

            return { left, bottom };
        },
        [getTextAnchorRect],
    );

    const detectTriggerFromCaret = useCallback(() => {
        const element = textAreaRef.current?.element;

        if (!element || document.activeElement !== element) {
            setTriggerState(null);

            return;
        }

        const caretOffset = getTextOffset(element);

        if (caretOffset === null) {
            setTriggerState(null);

            return;
        }

        const currentText = serializeDirectiveEditableText(element);
        const beforeCaret = currentText.slice(0, caretOffset);
        const triggerMatch = beforeCaret.match(/(?:^|\s)([@/])([^\s@/]*)$/);

        if (triggerMatch?.index === undefined) {
            setTriggerState(null);

            return;
        }

        const triggerChar = triggerMatch[1];
        const triggerText = triggerMatch[0];
        const leadingWhitespace = triggerText.startsWith(triggerChar) ? 0 : 1;
        const start = triggerMatch.index + leadingWhitespace;

        setTriggerState({
            type: triggerChar === '@' ? 'mention' : 'command',
            query: triggerMatch[2],
            start,
            end: caretOffset,
            position: getTriggerCommandPosition(element, start),
        });
    }, [getTextOffset, getTriggerCommandPosition, textAreaRef]);

    const updateTriggerAfterDomChange = useCallback(() => {
        window.requestAnimationFrame(detectTriggerFromCaret);
    }, [detectTriggerFromCaret]);

    const handleQueryChange = useCallback(
        (nextValue: string) => {
            setQuery(nextValue);
            updateTriggerAfterDomChange();
        },
        [setQuery, updateTriggerAfterDomChange],
    );

    const insertPromptText = useCallback(
        (start: number, end: number, insertedText: string, addTrailingSpace = true) => {
            const element = textAreaRef.current?.element;
            const currentText = element ? serializeDirectiveEditableText(element) : query;
            const separator = addTrailingSpace ? ' ' : '';
            const nextValue = `${currentText.slice(0, start)}${insertedText}${separator}${currentText.slice(end)}`;
            const nextCaretOffset = start + insertedText.length + separator.length;

            handleQueryChange(nextValue);
            textAreaRef.current?.changeText(nextValue);

            window.requestAnimationFrame(() => {
                const nextElement = textAreaRef.current?.element;

                if (!nextElement) return;

                nextElement.focus();
                setTextOffset(nextElement, nextCaretOffset);
                setTriggerState(null);
            });
        },
        [handleQueryChange, query, setTextOffset, textAreaRef],
    );

    const mentionSuggestionBases = useMemo<DirectiveSuggestionBase[]>(() => {
        return buildDirectiveSuggestions(agent);
    }, [agent]);

    const formatMentionDirective = (suggestion: DirectiveSuggestionBase) => {
        return formatDirectiveText(suggestion.type, suggestion.label, suggestion.id);
    };

    const getNormalizedText = (valueToNormalize: string) => valueToNormalize.toLowerCase().trim();

    const triggerSuggestions = useMemo<PromptSuggestion[]>(() => {
        if (!triggerState) return [];

        const normalizedQuery = getNormalizedText(triggerState.query);
        const matchesQuery = (label: string, value?: string, description?: string) => {
            if (!normalizedQuery) return true;

            return (
                getNormalizedText(label).includes(normalizedQuery) ||
                getNormalizedText(value || '').includes(normalizedQuery) ||
                getNormalizedText(description || '').includes(normalizedQuery)
            );
        };

        if (triggerState.type === 'command') {
            return plusDropdownOptions
                .filter((option) => matchesQuery(option.label, option.value))
                .slice(0, MAX_TRIGGER_ITEMS)
                .map((option: PlusDropdownOption) => ({
                    id: option.value,
                    label: option.label,
                    icon: option.icon,
                    onSelect: () => {
                        insertPromptText(triggerState.start, triggerState.end, '', false);
                        handlePlusDropdownSelect(option);
                        onCommandSelect();
                    },
                }));
        }

        return mentionSuggestionBases
            .filter((suggestion) => matchesQuery(suggestion.label, suggestion.id, suggestion.description))
            .slice(0, MAX_TRIGGER_ITEMS)
            .map((suggestion) => ({
                id: `${suggestion.type}:${suggestion.id}`,
                label: suggestion.label,
                description: suggestion.description,
                icon: suggestion.icon,
                onSelect: () => {
                    insertPromptText(triggerState.start, triggerState.end, formatMentionDirective(suggestion));
                },
            }));
    }, [
        handlePlusDropdownSelect,
        insertPromptText,
        mentionSuggestionBases,
        onCommandSelect,
        plusDropdownOptions,
        triggerState,
    ]);

    // The close is deferred so a click on the menu lands first; without the cleanup the timer
    // outlives the unmount and calls setState against a torn-down window.
    const closeTimerRef = useRef<number | undefined>(undefined);

    useEffect(() => () => window.clearTimeout(closeTimerRef.current), []);

    useEffect(() => {
        setHighlightedSuggestionIndex(0);
    }, [triggerState?.type, triggerState?.query]);

    useEffect(() => {
        if (highlightedSuggestionIndex >= triggerSuggestions.length) {
            setHighlightedSuggestionIndex(Math.max(triggerSuggestions.length - 1, 0));
        }
    }, [highlightedSuggestionIndex, triggerSuggestions.length]);

    const handleTriggerKeyDown = (event: KeyboardEvent<HTMLParagraphElement>) => {
        if (!triggerState) return false;
        if (triggerState.type === 'command' && plusDropdownOptions.length === 0) return false;
        if (triggerState.type === 'mention' && mentionSuggestionBases.length === 0) return false;

        if (event.key === 'Escape') {
            event.preventDefault();
            setTriggerState(null);

            return true;
        }

        if (triggerSuggestions.length === 0) return false;

        if (event.key === 'ArrowDown') {
            event.preventDefault();
            setHighlightedSuggestionIndex((index) => (index + 1) % triggerSuggestions.length);

            return true;
        }

        if (event.key === 'ArrowUp') {
            event.preventDefault();
            setHighlightedSuggestionIndex(
                (index) => (index - 1 + triggerSuggestions.length) % triggerSuggestions.length,
            );

            return true;
        }

        if (event.key === 'Enter' || event.key === 'Tab') {
            event.preventDefault();
            triggerSuggestions[highlightedSuggestionIndex]?.onSelect();

            return true;
        }

        return false;
    };

    const closeTriggerWithDelay = () => {
        window.clearTimeout(closeTimerRef.current);
        closeTimerRef.current = window.setTimeout(() => setTriggerState(null), 120);
    };

    const renderTriggerCommandBox = () => {
        if (!triggerState) return null;
        if (triggerState.type === 'command' && plusDropdownOptions.length === 0) return null;
        if (triggerState.type === 'mention' && mentionSuggestionBases.length === 0) return null;

        const emptyText = triggerState.type === 'command' ? 'No commands found' : 'No mentions found';

        return (
            <div
                className="composer-trigger-command-box scrollbar-vertical scrollbar-controller max-h-[230px]"
                style={triggerState.position}
                onMouseDown={(event) => event.preventDefault()}
            >
                {triggerSuggestions.length === 0 ? (
                    <div className="composer-trigger-command-empty">{emptyText}</div>
                ) : (
                    <div className="composer-trigger-command-list p-2">
                        {triggerSuggestions.map((suggestion, index) => {
                            const Icon = suggestion.icon;

                            return (
                                <button
                                    key={suggestion.id}
                                    type="button"
                                    className={[
                                        'composer-trigger-command-item',
                                        index === highlightedSuggestionIndex ? 'active' : '',
                                    ].join(' ')}
                                    onMouseEnter={() => setHighlightedSuggestionIndex(index)}
                                    onClick={suggestion.onSelect}
                                >
                                    <Icon className="composer-trigger-command-icon size-3.5 shrink-0" />
                                    <span className="flex min-w-0 flex-col text-left">
                                        <span className="composer-trigger-command-label">{suggestion.label}</span>
                                        {suggestion.description ? (
                                            <span className="composer-trigger-command-description">
                                                {suggestion.description}
                                            </span>
                                        ) : null}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                )}
            </div>
        );
    };

    return {
        closeTriggerWithDelay,
        handleQueryChange,
        handleTriggerKeyDown,
        renderTriggerCommandBox,
        updateTriggerAfterDomChange,
        mentionSuggestionBases,
    };
};
