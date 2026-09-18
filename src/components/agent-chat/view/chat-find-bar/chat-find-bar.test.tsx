import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useRef, useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { renderWithProviders } from '@/test/test-utils';

import ChatFindBar from './chat-find-bar';
import FindMatchTicks from './find-match-ticks';
import useFindInConversation from './use-find-in-conversation';

interface HostProps {
    messages?: string[];
    hasMoreOlderMessages?: boolean;
    onLoadOlderMessages?: () => void;
    onClose?: () => void;
    /** Renders the first message inside a collapsed CollapsibleMessageText shell. */
    collapseFirstMessage?: boolean;
    onShowMore?: () => void;
}

const Host = ({
    messages,
    hasMoreOlderMessages,
    onLoadOlderMessages,
    onClose,
    collapseFirstMessage,
    onShowMore,
}: HostProps) => {
    const viewportRef = useRef<HTMLDivElement>(null);
    const [isOpen, setIsOpen] = useState(true);
    const find = useFindInConversation({ viewportRef, isOpen });

    const handleClose = () => {
        setIsOpen(false);
        find.reset();
        onClose?.();
    };

    return (
        <div>
            {isOpen && (
                <FindMatchTicks
                    ticks={find.ticks}
                    activeKey={find.activePosition > 0 ? find.activePosition - 1 : null}
                />
            )}
            {isOpen && (
                <ChatFindBar
                    find={find}
                    onClose={handleClose}
                    hasMoreOlderMessages={hasMoreOlderMessages}
                    onLoadOlderMessages={onLoadOlderMessages}
                />
            )}
            <div ref={viewportRef}>
                <div data-slot="aui_message-group">
                    {(messages ?? ['the app switches language mid-conversation', 'which language was it']).map(
                        (message, index) => (
                            <div key={message} data-message-id={message}>
                                {collapseFirstMessage && index === 0 ? (
                                    <div className="collapsible-message-text">
                                        <div className="collapsible-message-text-content" data-collapsed="">
                                            <p>{message}</p>
                                        </div>
                                        <button type="button" onClick={onShowMore}>
                                            Show more
                                        </button>
                                    </div>
                                ) : (
                                    <p>{message}</p>
                                )}
                            </div>
                        ),
                    )}
                </div>
            </div>
        </div>
    );
};

const typeQuery = async (user: ReturnType<typeof userEvent.setup>, query: string) => {
    await user.type(screen.getByRole('textbox', { name: 'Find in conversation' }), query);
};

describe('FindMatchTicks', () => {
    // Real controls inside an aria-hidden rail would be unreachable focus stops,
    // so the rail is marks only and stepping stays with the bar.
    it('renders presentational marks, not focusable controls', () => {
        const { container } = renderWithProviders(
            <FindMatchTicks
                ticks={[
                    { key: 0, ratio: 0.1 },
                    { key: 1, ratio: 0.8 },
                ]}
                activeKey={1}
            />,
        );

        const rail = container.querySelector('.find-match-ticks');

        expect(rail).not.toBeNull();
        expect(rail?.getAttribute('aria-hidden')).toBe('true');
        expect(rail?.querySelectorAll('button')).toHaveLength(0);
        expect(rail?.querySelectorAll('.find-match-tick')).toHaveLength(2);
    });
});

describe('ChatFindBar', () => {
    it('reports the live match count and starts on the first match', async () => {
        const user = userEvent.setup();

        renderWithProviders(<Host />);
        await typeQuery(user, 'language');

        await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument());
    });

    it('steps forward and wraps with Enter', async () => {
        const user = userEvent.setup();

        renderWithProviders(<Host />);
        await typeQuery(user, 'language');
        await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument());

        await user.keyboard('{Enter}');
        await waitFor(() => expect(screen.getByText('2 of 2')).toBeInTheDocument());

        await user.keyboard('{Enter}');
        await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument());
    });

    it('steps backward with Shift+Enter', async () => {
        const user = userEvent.setup();

        renderWithProviders(<Host />);
        await typeQuery(user, 'language');
        await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument());

        await user.keyboard('{Shift>}{Enter}{/Shift}');
        await waitFor(() => expect(screen.getByText('2 of 2')).toBeInTheDocument());
    });

    it('steps with the arrow buttons', async () => {
        const user = userEvent.setup();

        renderWithProviders(<Host />);
        await typeQuery(user, 'language');
        await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'Next match' }));
        await waitFor(() => expect(screen.getByText('2 of 2')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'Previous match' }));
        await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument());
    });

    it('says so when nothing matches, and disables stepping', async () => {
        const user = userEvent.setup();

        renderWithProviders(<Host />);
        await typeQuery(user, 'zzzz');

        await waitFor(() => expect(screen.getByText('No results')).toBeInTheDocument());
        expect(screen.getByRole('button', { name: 'Next match' })).toBeDisabled();
        expect(screen.getByRole('button', { name: 'Previous match' })).toBeDisabled();
    });

    it('shows no count until something is typed', () => {
        renderWithProviders(<Host />);

        expect(screen.queryByText(/of/)).not.toBeInTheDocument();
        expect(screen.queryByText('No results')).not.toBeInTheDocument();
    });

    it('closes on Escape', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();

        renderWithProviders(<Host onClose={onClose} />);
        await typeQuery(user, 'language');
        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledOnce();
        await waitFor(() => expect(screen.queryByRole('search')).not.toBeInTheDocument());
    });

    it('closes on the close button', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();

        renderWithProviders(<Host onClose={onClose} />);
        await user.click(screen.getByRole('button', { name: 'Close find' }));

        expect(onClose).toHaveBeenCalledOnce();
    });

    // The count only ever covers loaded pages, so an unloaded tail must be stated
    // rather than silently folded into the number.
    it('warns that earlier messages are unloaded and can load them', async () => {
        const user = userEvent.setup();
        const onLoadOlderMessages = vi.fn();

        renderWithProviders(<Host hasMoreOlderMessages onLoadOlderMessages={onLoadOlderMessages} />);

        expect(screen.queryByText(/Earlier messages are not loaded yet/)).not.toBeInTheDocument();

        await typeQuery(user, 'language');

        await waitFor(() => expect(screen.getByText(/Earlier messages are not loaded yet/)).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'Load earlier' }));
        expect(onLoadOlderMessages).toHaveBeenCalledOnce();
    });

    // A menu or dialog on top owns Escape; closing find too would discard the query.
    it('leaves Escape alone while a menu is on top', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();

        renderWithProviders(
            <>
                <div role="menu" />
                <Host onClose={onClose} />
            </>,
        );

        await typeQuery(user, 'language');
        await user.keyboard('{Escape}');

        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('search')).toBeInTheDocument();
    });

    // The bar's own tooltips portal to the body, so a containment test cannot tell
    // them from a real overlay — the check has to go by role.
    it('still closes on Escape while one of its own tooltips is showing', async () => {
        const user = userEvent.setup();
        const onClose = vi.fn();

        renderWithProviders(
            <>
                <div role="tooltip">Next match (Enter)</div>
                <Host onClose={onClose} />
            </>,
        );

        await typeQuery(user, 'language');
        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledOnce();
    });

    // A match inside a clipped long message is unreachable until the message's own
    // toggle is driven, so navigation expands it rather than overriding its height.
    it('expands a collapsed message when navigating to a match inside it', async () => {
        const user = userEvent.setup();
        const onShowMore = vi.fn();

        renderWithProviders(<Host collapseFirstMessage onShowMore={onShowMore} />);

        await typeQuery(user, 'language');
        await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument());

        expect(onShowMore).toHaveBeenCalled();
    });

    // A new query is a new search: nothing about where the caret sat in the old
    // match set carries over.
    it('returns to the first match when the query changes', async () => {
        const user = userEvent.setup();

        renderWithProviders(<Host messages={['language one', 'language two', 'language three']} />);
        await typeQuery(user, 'language');
        await waitFor(() => expect(screen.getByText('1 of 3')).toBeInTheDocument());

        await user.keyboard('{Enter}{Enter}');
        await waitFor(() => expect(screen.getByText('3 of 3')).toBeInTheDocument());

        // Narrowing to two matches must land on the first of them.
        await typeQuery(user, ' t');
        await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument());
    });

    // A prepended older page shifts every array position, so the active match is
    // tracked by its message rather than its ordinal in the list.
    it('stays on the same occurrence when older messages are prepended', async () => {
        const user = userEvent.setup();
        const initial = ['language one', 'language two'];

        const { rerender } = renderWithProviders(<Host messages={initial} />);

        await typeQuery(user, 'language');
        await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument());

        await user.keyboard('{Enter}');
        await waitFor(() => expect(screen.getByText('2 of 2')).toBeInTheDocument());

        rerender(<Host messages={['language zero', ...initial]} />);

        await waitFor(() => expect(screen.getByText('3 of 3')).toBeInTheDocument());
    });

    it('re-counts when the thread gains content', async () => {
        const user = userEvent.setup();

        const { rerender } = renderWithProviders(<Host />);

        await typeQuery(user, 'language');
        await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument());

        rerender(<Host messages={['language one', 'language two', 'language three']} />);

        await waitFor(() => expect(screen.getByText('1 of 3')).toBeInTheDocument());
    });
});
