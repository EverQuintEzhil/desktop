import type { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import type { RefObject } from 'react';

import { buildConnectorFaviconUrl } from '@/lib/chat/connector-favicon';
import type { DirectiveSuggestionBase } from '@/lib/chat/directives';

import { DIRECTIVE_SECTION_LABELS, MAX_MENTION_TRIGGER_ITEMS } from '../../constants';
import { rankMentionSuggestions } from '../../utils/rank-mention-suggestions';
import { insertDirective } from '../extensions/directive-mention';

import { createComposerSuggestionRender, type ChatSuggestionItem } from './composer-suggestion-render';
import { createTriggerExtension } from './create-trigger-extension';

export type MentionItemsProvider = (query: string, signal: AbortSignal) => Promise<DirectiveSuggestionBase[]>;

// Only applied with a provider; a static list resolves synchronously, so a delay would be dead time.
const MENTION_PROVIDER_DEBOUNCE_MS = 200;

export interface MentionSuggestionItem extends ChatSuggestionItem {
    directiveType: string;
    directiveId: string;
}

export interface MentionSuggestionConfig {
    mentionItemsRef: RefObject<DirectiveSuggestionBase[]>;
    portalContainerRef?: RefObject<HTMLElement | null>;
    /** Replaces the "No mentions found" empty text while set (e.g. no agent picked yet). */
    emptyLabelRef?: RefObject<string | null>;
    /** Fetches the list per query. Overrides `mentionItemsRef` for hosts whose catalog is server-searched. */
    itemsProviderRef?: RefObject<MentionItemsProvider | undefined>;
}

const toMentionItem = (base: DirectiveSuggestionBase): MentionSuggestionItem => ({
    id: `${base.type}:${base.id}`,
    label: base.label,
    description: base.description,
    section: DIRECTIVE_SECTION_LABELS[base.type] ?? base.type,
    icon: base.icon,
    serverUrl: base.serverUrl,
    directiveType: base.type,
    directiveId: base.id,
});

const resolveFavicon = (item: MentionSuggestionItem): string | null => {
    if (item.directiveType !== 'mcp' || !item.serverUrl) {
        return null;
    }

    return buildConnectorFaviconUrl(item.serverUrl, 32) ?? null;
};

export const createMentionExtension = ({
    mentionItemsRef,
    portalContainerRef,
    emptyLabelRef,
    itemsProviderRef,
}: MentionSuggestionConfig): Extension => {
    const pluginKey = new PluginKey('chatEditorMentionTrigger');

    return createTriggerExtension<MentionSuggestionItem, MentionSuggestionItem>('chatEditorMentionTrigger', {
        char: '@',
        pluginKey,
        debounce: itemsProviderRef ? MENTION_PROVIDER_DEBOUNCE_MS : 0,
        items: async ({ query, signal }) => {
            const provider = itemsProviderRef?.current;

            if (!provider) {
                return rankMentionSuggestions(mentionItemsRef.current, query, MAX_MENTION_TRIGGER_ITEMS).map(
                    toMentionItem,
                );
            }

            // Already searched and paged server-side, so rank on an empty query: grouping only, no filter.
            const provided = await provider(query, signal);

            return rankMentionSuggestions(provided, '', provided.length).map(toMentionItem);
        },
        command: ({ editor, range, props }) => {
            insertDirective(editor, range, {
                directiveType: props.directiveType,
                label: props.label,
                id: props.directiveId,
                favicon: resolveFavicon(props),
            });
        },
        render: createComposerSuggestionRender<MentionSuggestionItem>('mention', {
            pluginKey,
            portalContainerRef,
            emptyLabelRef,
        }),
    });
};
