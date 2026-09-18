import { useCallback, useEffect, useRef, useState } from 'react';

import { buildConnectorFaviconUrl } from '@/lib/chat/connector-favicon';

import type { ComposerSuggestion, ComposerTriggerState } from '../types';

/** Shows the connector favicon for mcp suggestions carrying a `serverUrl`, falling back to the
 * suggestion's own icon on missing url or a load error. */
const TriggerItemIcon = ({ suggestion }: { suggestion: ComposerSuggestion }) => {
    const [hasError, setHasError] = useState(false);
    const faviconUrl = buildConnectorFaviconUrl(suggestion.serverUrl, 32);

    if (faviconUrl && !hasError) {
        return (
            <img
                src={faviconUrl}
                alt=""
                onError={() => setHasError(true)}
                className="composer-trigger-command-icon size-3.5 shrink-0 rounded-[3px] object-contain"
            />
        );
    }

    return <suggestion.icon className="composer-trigger-command-icon size-3.5 shrink-0" />;
};

export interface ComposerTriggerMenuProps {
    triggerState: ComposerTriggerState | null;
    suggestions: ComposerSuggestion[];
    /** Content signature of `suggestions`; the array reference is not stable across renders. */
    suggestionsSignature: string;
    highlightedIndex: number;
    onHighlightChange: (index: number) => void;
    hasCommandOptions: boolean;
    hasMentionOptions: boolean;
    emptyText?: string;
}

const renderTriggerItem = (
    suggestion: ComposerSuggestion,
    flatIndex: number,
    highlightedIndex: number,
    onHighlightChange: (index: number) => void,
) => {
    return (
        <button
            key={suggestion.id}
            type="button"
            data-flat-index={flatIndex}
            className={[
                'composer-trigger-command-item h-auto py-2',
                flatIndex === highlightedIndex ? 'active' : '',
            ].join(' ')}
            onMouseEnter={() => onHighlightChange(flatIndex)}
            onMouseDown={(event) => {
                event.preventDefault();
                suggestion.onSelect();
            }}
        >
            <TriggerItemIcon suggestion={suggestion} />
            <span className="flex min-w-0 flex-col text-left">
                <span className="composer-trigger-command-label w-max max-w-full wrap-break-word whitespace-normal">
                    {suggestion.label}
                </span>
                {suggestion.description ? (
                    <span className="composer-trigger-command-description">{suggestion.description}</span>
                ) : null}
            </span>
        </button>
    );
};

const renderMentionSections = (
    suggestions: ComposerSuggestion[],
    highlightedIndex: number,
    onHighlightChange: (index: number) => void,
) => {
    const sectionMap = new Map<string, { flatIndex: number; suggestion: ComposerSuggestion }[]>();

    suggestions.forEach((suggestion, flatIndex) => {
        const key = suggestion.section ?? 'Other';

        if (!sectionMap.has(key)) {
            sectionMap.set(key, []);
        }
        sectionMap.get(key)!.push({ flatIndex, suggestion });
    });

    return Array.from(sectionMap.entries()).map(([sectionLabel, items]) => (
        <div key={sectionLabel}>
            <div className="composer-trigger-command-section-label">{sectionLabel}</div>
            {items.map(({ suggestion, flatIndex }) =>
                renderTriggerItem(suggestion, flatIndex, highlightedIndex, onHighlightChange),
            )}
        </div>
    ));
};

/** Renders the "@"/"/" trigger suggestion box and keeps the highlighted item scrolled into view. */
const ComposerTriggerMenu = ({
    triggerState,
    suggestions,
    suggestionsSignature,
    highlightedIndex,
    onHighlightChange,
    hasCommandOptions,
    hasMentionOptions,
    emptyText,
}: ComposerTriggerMenuProps) => {
    const triggerListRef = useRef<HTMLDivElement>(null);

    // Radix's dialog scroll-lock (react-remove-scroll) preventDefaults wheel events outside its subtree, so the portaled list must scroll itself.
    const setTriggerListRef = useCallback((node: HTMLDivElement | null) => {
        triggerListRef.current = node;

        if (!node) return;

        const handleWheel = (event: WheelEvent) => {
            if (node.scrollHeight <= node.clientHeight) return;

            // deltaY arrives in lines or pages on some mice/browsers, not just pixels.
            let unit = 1;

            if (event.deltaMode === WheelEvent.DOM_DELTA_LINE) {
                unit = Number.parseFloat(getComputedStyle(node).lineHeight) || 18;
            } else if (event.deltaMode === WheelEvent.DOM_DELTA_PAGE) {
                unit = node.clientHeight;
            }

            const delta = event.deltaY * unit;
            const canMove = delta < 0 ? node.scrollTop > 0 : node.scrollTop + node.clientHeight < node.scrollHeight;

            // At the ends the event must keep bubbling so scroll chaining survives.
            if (!canMove) return;

            event.preventDefault();
            event.stopPropagation();
            node.scrollTop += delta;
        };

        node.addEventListener('wheel', handleWheel, { passive: false });
    }, []);

    useEffect(() => {
        const list = triggerListRef.current;

        if (!list) return;

        const activeItem = list.querySelector<HTMLElement>(`[data-flat-index="${highlightedIndex}"]`);

        activeItem?.scrollIntoView({ block: 'nearest' });
        // Signature, not the `suggestions` reference: that is fresh on nearly every render, so it
        // would re-scroll to the highlight on any keyup after the user has wheel-scrolled the list.
    }, [highlightedIndex, suggestionsSignature, triggerState?.query]);

    if (!triggerState) return null;
    if (triggerState.type === 'command' && !hasCommandOptions) return null;
    if (triggerState.type === 'mention' && !hasMentionOptions) return null;

    const resolvedEmptyText =
        emptyText ?? (triggerState.type === 'command' ? 'No commands found' : 'No mentions found');

    return (
        <div
            className="composer-trigger-command-box overflow-hidden"
            style={triggerState.position}
            onMouseDown={(event) => event.preventDefault()}
        >
            {suggestions.length === 0 ? (
                <div className="composer-trigger-command-empty">{resolvedEmptyText}</div>
            ) : (
                <div
                    ref={setTriggerListRef}
                    className="composer-trigger-command-list scrollbar-controller scrollbar-vertical max-h-[300px] p-2"
                >
                    {triggerState.type === 'mention'
                        ? renderMentionSections(suggestions, highlightedIndex, onHighlightChange)
                        : suggestions.map((suggestion, index) =>
                              renderTriggerItem(suggestion, index, highlightedIndex, onHighlightChange),
                          )}
                </div>
            )}
        </div>
    );
};

export default ComposerTriggerMenu;
