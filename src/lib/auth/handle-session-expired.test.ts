import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const showInfoToast = vi.fn();

vi.mock('@/utils', () => ({ showInfoToast }));

const assign = vi.fn();

/**
 * jsdom refuses real navigation, and `handleSessionExpired` keeps a module-level
 * `redirecting` latch, so every test needs a fresh module and a fresh location.
 */
const setLocation = (href: string) => {
    const url = new URL(href);

    Object.defineProperty(window, 'location', {
        configurable: true,
        value: {
            href: url.href,
            pathname: url.pathname,
            origin: url.origin,
            search: url.search,
            assign,
        },
    });
};

const loadModule = async () => {
    vi.resetModules();

    return import('./handle-session-expired');
};

beforeEach(() => {
    vi.useFakeTimers();
    sessionStorage.clear();
    localStorage.clear();
    assign.mockClear();
    showInfoToast.mockClear();
});

afterEach(() => {
    vi.useRealTimers();
});

describe('handleSessionExpired — deep link capture', () => {
    it('stores the current URL so the user returns to it after signing in', async () => {
        setLocation('http://localhost:3000/agent/agent-1/spaces/project-9');

        const { handleSessionExpired } = await loadModule();

        handleSessionExpired();

        expect(sessionStorage.getItem('deep_link')).toBe('http://localhost:3000/agent/agent-1/spaces/project-9');
    });

    it('clears the cached user so the app does not boot as authenticated', async () => {
        setLocation('http://localhost:3000/library');
        localStorage.setItem('user', '{"_id":"user-1"}');

        const { handleSessionExpired } = await loadModule();

        handleSessionExpired();

        expect(localStorage.getItem('user')).toBeNull();
    });

    it('redirects to /accounts after the notice has been shown', async () => {
        setLocation('http://localhost:3000/library');

        const { handleSessionExpired } = await loadModule();

        handleSessionExpired();

        expect(assign).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1200);

        expect(assign).toHaveBeenCalledWith('/accounts');
    });

    it('only redirects once even if several requests 401 together', async () => {
        setLocation('http://localhost:3000/library');

        const { handleSessionExpired } = await loadModule();

        handleSessionExpired();
        handleSessionExpired();
        handleSessionExpired();

        vi.advanceTimersByTime(1200);

        expect(assign).toHaveBeenCalledTimes(1);
    });
});

describe('handleSessionExpired — auth surfaces are left alone', () => {
    it.each([
        ['/accounts', 'http://localhost:3000/accounts'],
        ['/public', 'http://localhost:3000/public/login'],
        ['/logout', 'http://localhost:3000/logout'],
    ])('does nothing on %s', async (_label, href) => {
        setLocation(href);

        const { handleSessionExpired } = await loadModule();

        handleSessionExpired();

        vi.advanceTimersByTime(1200);

        expect(sessionStorage.getItem('deep_link')).toBeNull();
        expect(assign).not.toHaveBeenCalled();
        expect(showInfoToast).not.toHaveBeenCalled();
    });
});

describe('handleSessionExpired — chat restoration', () => {
    it('prefers a remembered chat URL when expiry happens away from the chat', async () => {
        setLocation('http://localhost:3000/agent/agent-1/chat/conv-42');

        const mod = await loadModule();

        mod.rememberChatDeepLink();

        setLocation('http://localhost:3000/settings/connectors');
        mod.handleSessionExpired();

        expect(sessionStorage.getItem('deep_link')).toBe('http://localhost:3000/agent/agent-1/chat/conv-42');
    });

    it('promises chat restoration in the notice when a conversation is recoverable', async () => {
        setLocation('http://localhost:3000/agent/agent-1/chat/conv-42');

        const { handleSessionExpired } = await loadModule();

        handleSessionExpired();

        expect(showInfoToast).toHaveBeenCalledWith(
            'Your session expired. Sign in to continue — your chat will be restored.',
        );
    });

    it('shows the plain notice when there is no conversation to restore', async () => {
        setLocation('http://localhost:3000/library');

        const { handleSessionExpired } = await loadModule();

        handleSessionExpired();

        expect(showInfoToast).toHaveBeenCalledWith('Your session expired. Please sign in again to continue.');
    });
});

describe('rememberChatDeepLink', () => {
    it('remembers a conversation URL', async () => {
        setLocation('http://localhost:3000/agent/agent-1/chat/conv-7');

        const { rememberChatDeepLink } = await loadModule();

        rememberChatDeepLink();

        expect(sessionStorage.getItem('last_chat_deep_link')).toBe('http://localhost:3000/agent/agent-1/chat/conv-7');
    });

    it('ignores a URL with no conversation id', async () => {
        setLocation('http://localhost:3000/agent/agent-1/chat');

        const { rememberChatDeepLink } = await loadModule();

        rememberChatDeepLink();

        expect(sessionStorage.getItem('last_chat_deep_link')).toBeNull();
    });
});

describe('captureDeepLink', () => {
    it('stores a non-auth URL', async () => {
        setLocation('http://localhost:3000/blogs/post-1');

        const { captureDeepLink } = await loadModule();

        captureDeepLink();

        expect(sessionStorage.getItem('deep_link')).toBe('http://localhost:3000/blogs/post-1');
    });

    it('refuses to store an auth surface, so login never bounces to itself', async () => {
        setLocation('http://localhost:3000/accounts');

        const { captureDeepLink } = await loadModule();

        captureDeepLink();

        expect(sessionStorage.getItem('deep_link')).toBeNull();
    });
});
