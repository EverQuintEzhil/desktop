import type { Extension } from '@tiptap/core';
import { PluginKey } from '@tiptap/pm/state';
import type { RefObject } from 'react';

import type { PlusDropdownOption } from '@/types/chat';

import { MAX_TRIGGER_ITEMS } from '../../constants';

import { createComposerSuggestionRender, type ChatSuggestionItem } from './composer-suggestion-render';
import { createTriggerExtension } from './create-trigger-extension';

export interface CommandSuggestionItem extends ChatSuggestionItem {
    option: PlusDropdownOption;
}

export interface CommandSuggestionConfig {
    commandOptionsRef: RefObject<PlusDropdownOption[]>;
    onCommandSelectRef: RefObject<(option: PlusDropdownOption) => void>;
    portalContainerRef?: RefObject<HTMLElement | null>;
}

const toCommandItem = (option: PlusDropdownOption): CommandSuggestionItem => ({
    id: option.value,
    label: option.label,
    icon: option.icon,
    option,
});

const matchesQuery = (option: PlusDropdownOption, query: string): boolean => {
    const needle = query.toLowerCase();

    return option.label.toLowerCase().includes(needle) || option.value.toLowerCase().includes(needle);
};

export const createCommandExtension = ({
    commandOptionsRef,
    onCommandSelectRef,
    portalContainerRef,
}: CommandSuggestionConfig): Extension => {
    const pluginKey = new PluginKey('chatEditorCommandTrigger');

    return createTriggerExtension<CommandSuggestionItem, CommandSuggestionItem>('chatEditorCommandTrigger', {
        char: '/',
        pluginKey,
        items: ({ query }) =>
            commandOptionsRef.current
                .filter((option) => matchesQuery(option, query))
                .slice(0, MAX_TRIGGER_ITEMS)
                .map(toCommandItem),
        command: ({ editor, range, props }) => {
            editor.chain().focus().deleteRange(range).run();
            onCommandSelectRef.current(props.option);
        },
        render: createComposerSuggestionRender<CommandSuggestionItem>('command', { pluginKey, portalContainerRef }),
    });
};
