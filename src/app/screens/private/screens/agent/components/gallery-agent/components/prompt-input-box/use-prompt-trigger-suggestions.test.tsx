import { act, render, screen } from '@testing-library/react';
import { SettingsIcon } from 'lucide-react';
import { useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from 'vitest';

import type { TextAreaRef } from '@/components/text-area';
import type { GalleryAgentType } from '@/types/admin';
import type { PlusDropdownOption } from '@/types/chat';

import { usePromptTriggerSuggestions } from './use-prompt-trigger-suggestions';

type Api = ReturnType<typeof usePromptTriggerSuggestions>;

interface HarnessProps {
    agent: GalleryAgentType;
    plusDropdownOptions: PlusDropdownOption[];
    handlePlusDropdownSelect: (option: PlusDropdownOption) => void;
    onCommandSelect: () => void;
    onQueryChange: (value: string) => void;
}

let api: Api;
let composer: HTMLParagraphElement;

const Harness = (props: HarnessProps) => {
    const [query, setQuery] = useState('');
    const textAreaRef = useRef<TextAreaRef | null>(null);

    const attachComposer = (node: HTMLParagraphElement | null) => {
        if (!node) {
            textAreaRef.current = null;

            return;
        }

        composer = node;
        textAreaRef.current = {
            element: node,
            focus: () => node.focus(),
            focusAtEnd: () => node.focus(),
            changeText: (value: string) => {
                node.textContent = value;
            },
        };
    };

    api = usePromptTriggerSuggestions({
        agent: props.agent,
        query,
        setQuery: (value: string) => {
            props.onQueryChange(value);
            setQuery(value);
        },
        textAreaRef,
        plusDropdownOptions: props.plusDropdownOptions,
        handlePlusDropdownSelect: props.handlePlusDropdownSelect,
        onCommandSelect: props.onCommandSelect,
    });

    return (
        <div className="chat-composer-input-wrap">
            <p ref={attachComposer} contentEditable tabIndex={0} suppressContentEditableWarning />
            {api.renderTriggerCommandBox()}
        </div>
    );
};

const agentWithDirectives = (overrides: Record<string, unknown> = {}) =>
    ({
        _id: 'agent-1',
        tools: [
            {
                _id: 't1',
                refName: 'web_search',
                name: 'web_search',
                description: 'Search the web',
            },
        ],
        skills: [{ _id: 'sk-1', name: 'Summarize', description: 'Condense a document' }],
        mcpServers: [{ _id: 'mcp-1', name: 'Figma', description: 'Design files' }],
        ...overrides,
    }) as unknown as GalleryAgentType;

const plusOption = (value: string, label: string): PlusDropdownOption => ({
    label,
    value,
    icon: SettingsIcon,
    onClick: () => {},
});

interface Callbacks {
    handlePlusDropdownSelect: Mock<(option: PlusDropdownOption) => void>;
    onCommandSelect: Mock<() => void>;
    onQueryChange: Mock<(value: string) => void>;
}

const renderHarness = (
    agent: GalleryAgentType = agentWithDirectives(),
    plusDropdownOptions: PlusDropdownOption[] = [plusOption('add-photo', 'Add photo')],
): Callbacks => {
    const callbacks: Callbacks = {
        handlePlusDropdownSelect: vi.fn(),
        onCommandSelect: vi.fn(),
        onQueryChange: vi.fn(),
    };

    render(<Harness agent={agent} plusDropdownOptions={plusDropdownOptions} {...callbacks} />);

    return callbacks;
};

/** Writes the composer text and puts a collapsed caret at its end. */
const typeInto = (text: string) => {
    act(() => {
        composer.focus();
        composer.textContent = text;

        const range = document.createRange();
        const selection = window.getSelection();

        range.setStart(composer.firstChild as Node, text.length);
        range.collapse(true);
        selection?.removeAllRanges();
        selection?.addRange(range);

        api.handleQueryChange(text);
    });
};

const pressKey = (key: string): boolean => {
    let handled = false;

    act(() => {
        handled = api.handleTriggerKeyDown({
            key,
            preventDefault: () => {},
        } as unknown as KeyboardEvent<HTMLParagraphElement>);
    });

    return handled;
};

const activeItemLabel = (): string | undefined =>
    document.querySelector('.composer-trigger-command-item.active')?.textContent ?? undefined;

describe('usePromptTriggerSuggestions', () => {
    beforeEach(() => {
        vi.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
            callback(0);

            return 0;
        });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('shows no suggestion box for plain text', () => {
        renderHarness();
        typeInto('a cat on a bicycle');

        expect(document.querySelector('.composer-trigger-command-box')).toBeNull();
    });

    it('shows no suggestion box while the composer is not focused', () => {
        renderHarness();
        typeInto('@');
        act(() => {
            composer.blur();
            api.updateTriggerAfterDomChange();
        });

        expect(document.querySelector('.composer-trigger-command-box')).toBeNull();
    });

    it('lists every mention source the agent exposes', () => {
        renderHarness();
        typeInto('@');

        expect(screen.getByRole('button', { name: /web_search/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Summarize/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Figma/ })).toBeInTheDocument();
    });

    it('inserts a named directive for a trigger at the start of the prompt', () => {
        const callbacks = renderHarness();

        typeInto('@sum');
        act(() => {
            screen.getByRole('button', { name: /Summarize/ }).click();
        });

        expect(composer.textContent).toBe(':skill[Summarize]{name=sk-1} ');
        expect(callbacks.onQueryChange).toHaveBeenLastCalledWith(':skill[Summarize]{name=sk-1} ');
    });

    it('keeps the text before a mid-prompt trigger and collapses a self-named directive', () => {
        renderHarness();

        typeInto('hi @we');
        act(() => {
            screen.getByRole('button', { name: /web_search/ }).click();
        });

        expect(composer.textContent).toBe('hi :tool[web_search] ');
    });

    it('matches a mention on its description as well as its label', () => {
        renderHarness();
        typeInto('@CONDENSE');

        expect(screen.getByRole('button', { name: /Summarize/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /Figma/ })).toBeNull();
    });

    it('caps the list at seven suggestions', () => {
        renderHarness(
            agentWithDirectives({
                tools: [],
                mcpServers: [],
                skills: Array.from({ length: 9 }, (_, index) => ({ _id: `sk-${index}`, name: `Skill ${index}` })),
            }),
        );
        typeInto('@');

        expect(document.querySelectorAll('.composer-trigger-command-item')).toHaveLength(7);
    });

    it('reports no mentions found when nothing matches', () => {
        renderHarness();
        typeInto('@zzz');

        expect(screen.getByText('No mentions found')).toBeInTheDocument();
    });

    it('renders nothing at all when the agent exposes no mention sources', () => {
        renderHarness(agentWithDirectives({ tools: [], skills: [], mcpServers: [] }));
        typeInto('@');

        expect(document.querySelector('.composer-trigger-command-box')).toBeNull();
    });

    it('runs a slash command, removing the typed trigger without a trailing space', () => {
        const option = plusOption('add-photo', 'Add photo');
        const callbacks = renderHarness(agentWithDirectives(), [option]);

        typeInto('draw /add');
        act(() => {
            screen.getByRole('button', { name: /Add photo/ }).click();
        });

        expect(composer.textContent).toBe('draw ');
        expect(callbacks.handlePlusDropdownSelect).toHaveBeenCalledWith(option);
        expect(callbacks.onCommandSelect).toHaveBeenCalledTimes(1);
    });

    it('reports no commands found when nothing matches', () => {
        renderHarness();
        typeInto('/zzz');

        expect(screen.getByText('No commands found')).toBeInTheDocument();
    });

    it('renders nothing when there are no slash commands to offer', () => {
        renderHarness(agentWithDirectives(), []);
        typeInto('/');

        expect(document.querySelector('.composer-trigger-command-box')).toBeNull();
    });

    it('leaves key handling to the composer when no trigger is open', () => {
        renderHarness();
        typeInto('hello');

        expect(pressKey('ArrowDown')).toBe(false);
        expect(pressKey('Escape')).toBe(false);
    });

    it('closes the box on Escape and claims the key', () => {
        renderHarness();
        typeInto('@');

        expect(pressKey('Escape')).toBe(true);
        expect(document.querySelector('.composer-trigger-command-box')).toBeNull();
    });

    it('moves the highlight down and wraps back to the first item', () => {
        renderHarness();
        typeInto('@');

        expect(activeItemLabel()).toContain('web_search');
        expect(pressKey('ArrowDown')).toBe(true);
        expect(activeItemLabel()).toContain('Summarize');
        pressKey('ArrowDown');
        expect(activeItemLabel()).toContain('Figma');
        pressKey('ArrowDown');
        expect(activeItemLabel()).toContain('web_search');
    });

    it('wraps to the last item on ArrowUp', () => {
        renderHarness();
        typeInto('@');

        expect(pressKey('ArrowUp')).toBe(true);
        expect(activeItemLabel()).toContain('Figma');
    });

    it('selects the highlighted suggestion with Enter', () => {
        renderHarness();
        typeInto('@');
        pressKey('ArrowDown');

        expect(pressKey('Enter')).toBe(true);
        expect(composer.textContent).toBe(':skill[Summarize]{name=sk-1} ');
    });

    it('selects the highlighted suggestion with Tab', () => {
        renderHarness();
        typeInto('@');

        expect(pressKey('Tab')).toBe(true);
        expect(composer.textContent).toBe(':tool[web_search] ');
    });

    it('still claims Escape but not the arrows when nothing matches', () => {
        renderHarness();
        typeInto('@zzz');

        expect(pressKey('ArrowDown')).toBe(false);
        expect(pressKey('Enter')).toBe(false);
        expect(pressKey('Escape')).toBe(true);
    });

    it('clamps the highlight when the filtered list shrinks', () => {
        renderHarness();
        typeInto('@');
        pressKey('ArrowUp');

        expect(activeItemLabel()).toContain('Figma');

        typeInto('@su');

        expect(document.querySelectorAll('.composer-trigger-command-item')).toHaveLength(1);
        expect(activeItemLabel()).toContain('Summarize');
    });

    it('highlights a suggestion on hover and selects it on click', () => {
        renderHarness();
        typeInto('@');

        const figma = screen.getByRole('button', { name: /Figma/ });

        act(() => {
            figma.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        });

        expect(activeItemLabel()).toContain('Figma');

        act(() => {
            figma.click();
        });

        expect(composer.textContent).toBe(':mcp[Figma] ');
    });

    it('closes the box after the blur delay', () => {
        vi.useFakeTimers();
        try {
            renderHarness();
            typeInto('@');

            act(() => {
                api.closeTriggerWithDelay();
            });

            expect(document.querySelector('.composer-trigger-command-box')).not.toBeNull();

            act(() => {
                vi.advanceTimersByTime(120);
            });

            expect(document.querySelector('.composer-trigger-command-box')).toBeNull();
        } finally {
            vi.useRealTimers();
        }
    });

    it('exposes the mention bases it built from the agent', () => {
        renderHarness();

        expect(api.mentionSuggestionBases.map((base) => `${base.type}:${base.id}`)).toEqual([
            'tool:web_search',
            'skill:sk-1',
            'mcp:Figma',
        ]);
    });
});
