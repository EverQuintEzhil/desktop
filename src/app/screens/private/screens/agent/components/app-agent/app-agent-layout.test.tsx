import { act, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it } from 'vitest';

import { installGalleryDomShims, installRichTextDomShims, installScrollIntoViewShim } from '@/test/dom-shims';
import { installWidthAwareMatchMedia } from '@/test/match-media';
import { apiUrl, envelope, pagedEnvelope, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { AppAgentType, ChatAgentType } from '@/types/admin';

import ChatAgent from '../chat-agent';

import AppAgent from './app-agent';

installGalleryDomShims();
installRichTextDomShims();
installScrollIntoViewShim();

Object.defineProperty(Element.prototype, 'scrollTo', { configurable: true, value: () => {} });

const LONG_QUESTION = 'Why do we lose, and who should chase what we are losing across the whole Middle East region?';

const appAgent = {
    _id: 'app-agent-1',
    slug: 'app-agent-1',
    identifier: 'app-agent-identifier-1',
    name: 'Scout',
    type: 'chat',
    apps: [],
    tools: [],
    uiConfig: {
        componentType: 'app',
        type: 'chat',
        app: { assistantDefaultOpen: true, assistantSide: 'right' },
        home: {
            title: 'Scout',
            search: { placeholder: 'Ask Scout — pursuits, teams, win/loss, signals' },
            questions: ['How does our pipeline look?', LONG_QUESTION],
        },
    },
} as unknown as AppAgentType;

const chatAgent = {
    ...appAgent,
    uiConfig: { ...appAgent.uiConfig, componentType: 'chat', app: undefined },
} as unknown as ChatAgentType;

const renderAppAgent = () =>
    renderWithProviders(
        <Routes>
            <Route path="/agent/:agentId/*" element={<AppAgent agent={appAgent} />} />
        </Routes>,
        { route: '/agent/app-agent-1' },
    );

const renderFullPageChat = () =>
    renderWithProviders(
        <Routes>
            <Route path="/agent/:agentId/*" element={<ChatAgent agent={chatAgent} />} />
        </Routes>,
        { route: '/agent/app-agent-1' },
    );

const findFooter = async () => {
    await screen.findByText('AI can make mistakes. Please check your work.');

    return document.querySelector<HTMLElement>('.footer-container')!;
};

const findHomeScreen = async () => {
    await screen.findByRole('button', { name: LONG_QUESTION });

    return document.querySelector<HTMLElement>('.home-screen')!;
};

const questionLabel = () => screen.getByRole('button', { name: LONG_QUESTION }).querySelector('span')!;

const user = userEvent.setup({ delay: null });

// prosemirror-view keys off `keyCode`, and cancels Escape whatever the chat does with it — so
// user-event's keyCode-less synthetic never reaches the real code path. See composer-escape.test.ts.
const pressEscapeInComposer = () => {
    const composer = document.querySelector<HTMLElement>('.chat-editor__content[contenteditable="true"]')!;

    composer.focus();
    act(() => {
        composer.dispatchEvent(
            new KeyboardEvent('keydown', { key: 'Escape', keyCode: 27, bubbles: true, cancelable: true }),
        );
    });
};

const { setWindowWidth } = installWidthAwareMatchMedia(1600);

// The composer autofocuses when the chat finishes mounting, which is later than the
// home screen's own render, and the drawer's own focus lands on the panel before it.
// Closing while that autofocus is still pending lets it overwrite the focus the close
// handler parked on the reopen button, so wait for the composer itself to hold focus.
const settleComposerFocus = () =>
    waitFor(() =>
        expect(document.activeElement).toBe(document.querySelector('.chat-editor__content[contenteditable="true"]')),
    );

const panel = () => document.querySelector<HTMLElement>('[data-slot="app-assistant-panel"]')!;
const appPane = () => document.querySelector<HTMLElement>('[data-slot="app-agent-pane"]')!;
const scrim = () => document.querySelector<HTMLElement>('[data-slot="app-assistant-scrim"]');

beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    setWindowWidth(1600);
    server.use(
        http.get(apiUrl('/users/me'), () => envelope({})),
        http.get(apiUrl('/conversations'), () => pagedEnvelope([])),
        http.get(apiUrl('/mcpservers'), () => pagedEnvelope([])),
        http.get(apiUrl('/skills'), () => pagedEnvelope([])),
        http.get(apiUrl('/routines'), () => pagedEnvelope([])),
        http.get(apiUrl('/routines/runs'), () => pagedEnvelope([])),
        http.get(apiUrl('/agents/:agentId/preferences'), () => envelope(null)),
        http.get(apiUrl('/agents/:agentId'), () => envelope(appAgent)),
        http.get(apiUrl('/ai/chat/attach'), () => new Response(null, { status: 204 })),
    );
});

/**
 * The assistant panel is 340-640px wide however wide the window is, so the chat home cannot
 * lean on viewport breakpoints: the panel variant has to lay itself out as a narrow column.
 */
describe('AppAgent assistant panel — narrow layout', () => {
    it('keeps the disclaimer in flow below the starter questions instead of pinning it over them', async () => {
        renderAppAgent();

        const footer = await findFooter();

        expect(footer).not.toHaveClass('lg:absolute');
        expect(footer).toHaveClass('static');
    });

    it('names the agent once on the home screen — the chrome row owns the identity', async () => {
        renderAppAgent();

        await findHomeScreen();

        const named = [...document.querySelectorAll('.brand-name')].filter((el) => el.textContent?.trim() === 'Scout');

        expect(named).toHaveLength(1);
        expect(named[0].closest('.assistant-panel-chrome-identity')).not.toBeNull();
    });

    it('lets starter questions wrap fully instead of clamping them', async () => {
        renderAppAgent();

        await findHomeScreen();

        expect(questionLabel()).not.toHaveClass('line-clamp-2');
    });

    it('pins the chat box below the starter questions, like the mobile layout', async () => {
        renderAppAgent();

        await findHomeScreen();
        const questions = document.querySelector('.question-grid')!;
        const composer = document.querySelector('.chat-editor__content')!;

        expect(questions.compareDocumentPosition(composer) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('caps how tall the chat box may grow inside the panel', async () => {
        renderAppAgent();

        await findHomeScreen();

        expect(document.querySelector('[data-slot="app-assistant-panel"]')).toHaveClass(
            '[--chat-editor-max-height:40svh]',
        );
    });

    it('pins the chat box and scrolls only the title and starter questions', async () => {
        renderAppAgent();

        await findHomeScreen();
        const questions = document.querySelector('.question-grid')!;
        const scroller = questions.closest('.scrollbar-controller')!;
        const composer = document.querySelector('.chat-editor__content')!;

        expect(scroller).toHaveClass('scrollbar-vertical');
        expect(scroller.contains(composer)).toBe(false);
        // Auto margins, not `justify-center`: the top of an overflowing block has to stay reachable.
        expect(questions.parentElement).toHaveClass('my-auto');
        expect(scroller).not.toHaveClass('justify-center');
    });

    // 56px is the app bundle's own header height, which the bundle owns and this repo cannot read.
    it('gives the chrome the same 56px height as the app header it sits beside', async () => {
        renderAppAgent();

        await findHomeScreen();

        expect(document.querySelector('.assistant-panel-chrome')).toHaveClass('h-14');
    });
});

describe('full-page chat home — unchanged by the panel layout', () => {
    it('still pins the disclaimer to the bottom on wide screens', async () => {
        renderFullPageChat();

        const footer = await findFooter();

        expect(footer).toHaveClass('lg:absolute');
    });

    it('still shows the chat box above the starter questions', async () => {
        renderFullPageChat();

        await waitFor(() => expect(screen.getByRole('button', { name: LONG_QUESTION })).toBeInTheDocument());
        const questions = document.querySelector('.question-grid')!;
        const composer = document.querySelector('.chat-editor__content')!;

        expect(composer.compareDocumentPosition(questions) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('still clamps starter questions to two lines', async () => {
        renderFullPageChat();

        await waitFor(() => expect(screen.getByRole('button', { name: LONG_QUESTION })).toBeInTheDocument());

        expect(questionLabel()).toHaveClass('line-clamp-2');
    });
});

/**
 * Below Tailwind's `lg` (1024px) the panel overlays the app as a drawer — the same width at which
 * it already overlaid before this layout. Every window at or above it docks, however tight that
 * leaves the app pane, because the pane scrolls and a desktop window losing the docked panel is
 * the worse outcome.
 */
describe('AppAgent assistant panel — one pane at a time in narrow windows', () => {
    it('docks beside the app with a resize grip when both fit', async () => {
        renderAppAgent();

        await findHomeScreen();

        expect(panel()).toHaveAttribute('data-layout', 'docked');
        expect(scrim()).toBeNull();
        expect(screen.getByRole('separator', { name: 'Resize assistant panel' })).toBeInTheDocument();
    });

    it('keeps the stored width as the preference and holds it back in CSS so the app pane keeps 684px', async () => {
        localStorage.setItem(`fm.app-assistant.${appAgent._id}.width`, '640');

        renderAppAgent();

        await findHomeScreen();

        expect(panel().style.width).toBe('640px');
        expect(panel().style.maxWidth).toBe('calc(100vw - 684px)');
        expect(appPane()).toHaveClass('isolate');
        expect(appPane()).not.toHaveAttribute('inert');
    });

    it.each([1024, 1158, 1280, 1330])('docks at %ipx, a desktop window, rather than overlaying', async (width) => {
        setWindowWidth(width);

        renderAppAgent();

        await findHomeScreen();

        expect(panel()).toHaveAttribute('data-layout', 'docked');
        expect(scrim()).toBeNull();
        expect(appPane()).not.toHaveAttribute('inert');
    });

    it('becomes a drawer over a scrim below 1024px, without a resize grip', async () => {
        setWindowWidth(900);

        renderAppAgent();

        await findHomeScreen();

        expect(panel()).toHaveAttribute('data-layout', 'drawer');
        expect(panel().style.maxWidth).toBe('640px');
        expect(panel()).toHaveAttribute('role', 'dialog');
        expect(panel()).toHaveAttribute('aria-modal', 'true');
        expect(appPane()).toHaveAttribute('inert');
        expect(scrim()).toBeInTheDocument();
        expect(screen.queryByRole('separator', { name: 'Resize assistant panel' })).not.toBeInTheDocument();
    });

    it('switches layouts live as the window is resized', async () => {
        renderAppAgent();

        await findHomeScreen();
        expect(panel()).toHaveAttribute('data-layout', 'docked');

        setWindowWidth(900);

        expect(panel()).toHaveAttribute('data-layout', 'drawer');
    });

    it('puts the launcher bottom-right and outside the pane, so a bundle header cannot cover it', async () => {
        setWindowWidth(440);

        renderAppAgent();

        await findHomeScreen();
        await user.click(scrim()!);

        const launcher = screen.getByRole('button', { name: 'Open Scout' }).parentElement!;

        expect(launcher).toHaveClass('right-5');
        expect(launcher).toHaveClass('bottom-5');
        // The pane is an isolated stacking context; a launcher inside it loses to a sticky header.
        expect(appPane().contains(launcher)).toBe(false);
    });

    it('leaves the app pane at the window width, with no horizontal scroll of its own', async () => {
        setWindowWidth(440);

        renderAppAgent();

        await findHomeScreen();

        expect(appPane().querySelector('.scrollbar-horizontal')).toBeNull();
        expect(appPane()).toHaveClass('min-w-0');
    });

    it('closes the drawer from the scrim without storing it as a preference', async () => {
        setWindowWidth(900);

        renderAppAgent();

        await findHomeScreen();
        await user.click(scrim()!);

        expect(scrim()).toBeNull();
        expect(panel()).toHaveClass('hidden');
        expect(appPane()).not.toHaveAttribute('inert');
        expect(screen.getByRole('button', { name: 'Open Scout' })).toBeInTheDocument();
        expect(localStorage.getItem(`fm.app-assistant.${appAgent._id}.open`)).toBeNull();
    });

    it('closes the drawer on Escape from an idle chat box', async () => {
        setWindowWidth(900);

        renderAppAgent();

        await findHomeScreen();

        pressEscapeInComposer();

        expect(panel()).toHaveClass('hidden');
    });

    it('moves focus into the drawer on open and back to the trigger on close', async () => {
        setWindowWidth(900);

        renderAppAgent();

        await findHomeScreen();
        await settleComposerFocus();
        await user.click(scrim()!);

        const openButton = screen.getByRole('button', { name: 'Open Scout' });

        expect(document.activeElement).toBe(openButton);

        await user.click(openButton);

        expect(panel().contains(document.activeElement)).toBe(true);
    });

    it('leaves Escape alone during an IME composition and on an auto-repeat', async () => {
        setWindowWidth(900);

        renderAppAgent();

        await findHomeScreen();
        const question = screen.getByRole('button', { name: LONG_QUESTION });

        question.focus();
        act(() => {
            question.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Escape',
                    keyCode: 27,
                    isComposing: true,
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(panel()).not.toHaveClass('hidden');

        act(() => {
            question.dispatchEvent(
                new KeyboardEvent('keydown', {
                    key: 'Escape',
                    keyCode: 27,
                    repeat: true,
                    bubbles: true,
                    cancelable: true,
                }),
            );
        });
        expect(panel()).not.toHaveClass('hidden');
    });

    it('keeps focus in the chat when a resize only re-docks the open panel', async () => {
        setWindowWidth(900);

        renderAppAgent();

        await findHomeScreen();
        const composer = document.querySelector<HTMLElement>('.chat-editor__content[contenteditable="true"]')!;

        composer.focus();
        setWindowWidth(1600);

        expect(panel()).toHaveAttribute('data-layout', 'docked');
        expect(document.activeElement).toBe(composer);
    });

    it('parks focus on the reopen button when a resize hides the panel', async () => {
        setWindowWidth(900);

        renderAppAgent();

        await findHomeScreen();
        pressEscapeInComposer();
        setWindowWidth(1600);

        expect(panel()).not.toHaveClass('hidden');

        setWindowWidth(900);

        expect(panel()).toHaveClass('hidden');
        expect(document.activeElement).toBe(screen.getByRole('button', { name: 'Open Scout' }));
    });

    it('keeps the chat mounted when the window reveals the panel after a dismissal', async () => {
        setWindowWidth(900);

        const first = renderAppAgent();

        await findHomeScreen();
        await user.click(scrim()!);
        first.unmount();

        renderAppAgent();

        await screen.findByRole('button', { name: 'Open Scout' });
        expect(panel()).toHaveClass('hidden');

        setWindowWidth(1600);

        expect(panel()).not.toHaveClass('hidden');
        await waitFor(() => expect(panel().querySelector('.chat-editor__content')).toBeInTheDocument());
    });

    it('remembers a scrim dismissal for the tab, but not as the docked preference', async () => {
        setWindowWidth(900);

        const first = renderAppAgent();

        await findHomeScreen();
        await user.click(scrim()!);
        first.unmount();

        renderAppAgent();

        await screen.findByRole('button', { name: 'Open Scout' });
        expect(panel()).toHaveClass('hidden');

        setWindowWidth(1600);

        expect(panel()).not.toHaveClass('hidden');
        // A panel revealed by the window, with no one pressing anything, still carries the chat.
        await waitFor(() => expect(panel().querySelector('.chat-editor__content')).toBeInTheDocument());
    });

    it('still stores a Hide from the panel chrome as the preference', async () => {
        setWindowWidth(900);

        renderAppAgent();

        await findHomeScreen();
        await user.click(screen.getByRole('button', { name: 'Hide Scout' }));

        expect(localStorage.getItem(`fm.app-assistant.${appAgent._id}.open`)).toBe('false');
    });
});
