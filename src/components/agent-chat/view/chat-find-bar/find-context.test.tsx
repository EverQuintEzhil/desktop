import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { IS_MAC } from '@/hooks/keyboard-shortcuts/binding';
import type { MeProfile } from '@/lib/api';
import { envelope, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import ChatFindBar from './chat-find-bar';
import { FindProvider, useFindContext } from './find-context';
import FindInChatButton from './find-in-chat-button';

/** Stands in for the header, which is a sibling of the thread, not a child. */
const HeaderStandIn = () => {
    const context = useFindContext();

    if (!context?.isOpen) {
        return (
            <div>
                header without bar
                <FindInChatButton />
            </div>
        );
    }

    return (
        <ChatFindBar
            find={context.find}
            onClose={context.close}
            focusRequest={context.focusRequest}
            hasMoreOlderMessages={context.hasMoreOlderMessages}
            isLoadingOlderMessages={context.isLoadingOlderMessages}
            onLoadOlderMessages={context.onLoadOlderMessages}
        />
    );
};

/** Stands in for the thread, which owns the scrollable viewport. */
const ThreadStandIn = ({ onRequestOlder }: { onRequestOlder?: () => void }) => {
    const context = useFindContext();

    if (context && onRequestOlder) context.requestOlderMessagesRef.current = onRequestOlder;

    return (
        <div ref={context?.viewportRef}>
            <div data-slot="aui_message-group">
                <div data-message-id="m1">
                    <p>the app switches language mid-conversation</p>
                </div>
                <div data-message-id="m2">
                    <p>which language was it</p>
                </div>
            </div>
        </div>
    );
};

const pressFindShortcut = async (user: ReturnType<typeof userEvent.setup>) => {
    await user.keyboard(IS_MAC ? '{Meta>}f{/Meta}' : '{Control>}f{/Control}');
};

/** The shortcut registry resolves its bindings from the signed-in profile. */
const stubProfile = () => {
    const profile = {
        _id: 'user-1',
        name: { first: 'Jane', last: 'Doe' },
        role: 'user',
        email: 'jane.doe@example.com',
        preferences: null,
    } as MeProfile;

    server.use(respond('get', '/users/me', () => envelope(profile)));
};

describe('FindProvider', () => {
    beforeEach(stubProfile);

    it('opens the header bar on the shortcut and searches the thread below it', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <FindProvider isEnabled>
                <HeaderStandIn />
                <ThreadStandIn />
            </FindProvider>,
        );

        expect(screen.getByText('header without bar')).toBeInTheDocument();

        await pressFindShortcut(user);

        await waitFor(() => expect(screen.getByRole('search')).toBeInTheDocument());

        await user.type(screen.getByRole('textbox', { name: 'Find in conversation' }), 'language');

        await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument());
    });

    it('stays closed when find is not enabled for the surface', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <FindProvider>
                <HeaderStandIn />
                <ThreadStandIn />
            </FindProvider>,
        );

        await pressFindShortcut(user);

        await waitFor(() => expect(screen.getByText('header without bar')).toBeInTheDocument());
        expect(screen.queryByRole('search')).not.toBeInTheDocument();
    });

    it('discards the query when the bar is closed', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <FindProvider isEnabled>
                <HeaderStandIn />
                <ThreadStandIn />
            </FindProvider>,
        );

        await pressFindShortcut(user);
        await waitFor(() => expect(screen.getByRole('search')).toBeInTheDocument());
        await user.type(screen.getByRole('textbox', { name: 'Find in conversation' }), 'language');
        await waitFor(() => expect(screen.getByText('1 of 2')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'Close find' }));
        await pressFindShortcut(user);

        await waitFor(() => expect(screen.getByRole('search')).toBeInTheDocument());
        expect(screen.getByRole('textbox', { name: 'Find in conversation' })).toHaveValue('');
    });

    it('opens the bar from the header control, and hides the control while open', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <FindProvider isEnabled>
                <HeaderStandIn />
                <ThreadStandIn />
            </FindProvider>,
        );

        const control = await screen.findByRole('button', { name: 'Find in chat' });

        await user.click(control);

        await waitFor(() => expect(screen.getByRole('search')).toBeInTheDocument());
        expect(screen.queryByRole('button', { name: 'Find in chat' })).not.toBeInTheDocument();
    });

    // Advertising a key that does nothing is worse than advertising none.
    it('labels the header control with the resolved shortcut', async () => {
        renderWithProviders(
            <FindProvider isEnabled>
                <HeaderStandIn />
                <ThreadStandIn />
            </FindProvider>,
        );

        const control = await screen.findByRole('button', { name: 'Find in chat' });

        await waitFor(() => expect(control).toHaveTextContent(IS_MAC ? '⌘F' : 'CtrlF'));
    });

    it('offers no header control on a surface that cannot search', () => {
        renderWithProviders(
            <FindProvider>
                <HeaderStandIn />
                <ThreadStandIn />
            </FindProvider>,
        );

        expect(screen.queryByRole('button', { name: 'Find in chat' })).not.toBeInTheDocument();
    });

    // The bar cannot capture the scroll anchor the prepend restore needs, so the
    // thread registers an anchored version and the bar has to reach that one.
    it('routes Load earlier through the version the thread registered', async () => {
        const user = userEvent.setup();
        const onRequestOlder = vi.fn();

        renderWithProviders(
            <FindProvider isEnabled hasMoreOlderMessages onLoadOlderMessages={() => {}}>
                <HeaderStandIn />
                <ThreadStandIn onRequestOlder={onRequestOlder} />
            </FindProvider>,
        );

        await pressFindShortcut(user);
        await waitFor(() => expect(screen.getByRole('search')).toBeInTheDocument());
        await user.type(screen.getByRole('textbox', { name: 'Find in conversation' }), 'language');

        await user.click(await screen.findByRole('button', { name: 'Load earlier' }));

        expect(onRequestOlder).toHaveBeenCalledOnce();
    });

    // Opening from the header control unmounts that control, so the bar cannot see
    // what held focus before the search — the provider has to capture it.
    it('returns focus to the composer it was opened from', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <FindProvider isEnabled>
                <button type="button" autoFocus>
                    Composer stand-in
                </button>
                <HeaderStandIn />
                <ThreadStandIn />
            </FindProvider>,
        );

        const composer = screen.getByRole('button', { name: 'Composer stand-in' });

        await pressFindShortcut(user);

        await waitFor(() => expect(screen.getByRole('search')).toBeInTheDocument());
        expect(composer).not.toHaveFocus();

        await user.click(screen.getByRole('button', { name: 'Close find' }));

        await waitFor(() => expect(composer).toHaveFocus());
    });

    it('returns focus to the header control when that is what opened it', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <FindProvider isEnabled>
                <HeaderStandIn />
                <ThreadStandIn />
            </FindProvider>,
        );

        await user.click(await screen.findByRole('button', { name: 'Find in chat' }));

        await waitFor(() => expect(screen.getByRole('search')).toBeInTheDocument());

        await user.click(screen.getByRole('button', { name: 'Close find' }));

        await waitFor(() => expect(screen.getByRole('button', { name: 'Find in chat' })).toHaveFocus());
    });

    // The shortcut and the Escape handler have to agree about who owns the keyboard,
    // or find opens behind a dialog that cannot close it.
    it('leaves the shortcut to the browser while a dialog is open', async () => {
        const user = userEvent.setup();

        renderWithProviders(
            <FindProvider isEnabled>
                <div role="dialog" data-state="open" />
                <HeaderStandIn />
                <ThreadStandIn />
            </FindProvider>,
        );

        await pressFindShortcut(user);

        expect(screen.queryByRole('search')).toBeNull();
        expect(screen.getByText('header without bar')).toBeInTheDocument();
    });
});
