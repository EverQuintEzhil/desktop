import { within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, server } from '@/test/msw';
import { renderWithProviders, screen, waitFor } from '@/test/test-utils';

import ArtifactPane from './artifact-pane';
import type { ArtifactPointer } from './artifact-types';

vi.mock('@/components/markdown', () => ({
    default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
    MermaidDiagram: () => null,
    CARD_PROSE_CLASS_NAME: 'prose',
}));

const ARTIFACT_ID = 'conv-1:plan';

const pointer = (versionNumber: number): ArtifactPointer => ({
    toolCallId: 'call-1',
    artifactId: ARTIFACT_ID,
    slug: 'plan',
    title: 'Launch plan',
    artifactType: 'markdown',
    language: null,
    versionNumber,
});

const headDocument = {
    artifact_id: ARTIFACT_ID,
    agent_id: 'agent-1',
    conversation_id: 'conv-1',
    slug: 'plan',
    title: 'Launch plan',
    artifact_type: 'markdown',
    latest_version: 3,
    creator_id: 'user-1',
    last_author_kind: 'user',
    created_at: '2026-09-09T10:00:00.000Z',
    updated_at: '2026-09-09T12:00:00.000Z',
};

const versionDocument = (versionNumber: number) => ({
    artifact_id: ARTIFACT_ID,
    version_number: versionNumber,
    title: 'Launch plan',
    artifact_type: 'markdown',
    content_bytes: 12,
    author_kind: versionNumber === 1 ? 'model' : 'user',
    author_id: 'user-1',
    author_name: versionNumber === 1 ? null : 'Fizan',
    restored_from_version: null,
    created_at: '2026-09-09T10:00:00.000Z',
    content: `# Plan v${versionNumber}`,
});

const stubReads = () => {
    server.use(
        http.get(apiUrl(`/ai/artifacts/${encodeURIComponent(ARTIFACT_ID)}`), () => envelope(headDocument)),
        http.get(apiUrl(`/ai/artifacts/${encodeURIComponent(ARTIFACT_ID)}/versions`), () =>
            envelope([versionDocument(3), versionDocument(2), versionDocument(1)]),
        ),
        http.get(apiUrl(`/ai/artifacts/${encodeURIComponent(ARTIFACT_ID)}/versions/:versionNumber`), ({ params }) =>
            envelope(versionDocument(Number(params.versionNumber))),
        ),
    );
};

const onClose = vi.fn();

const writeText = vi.fn<(text: string) => Promise<void>>();

const setupUser = () => {
    const user = userEvent.setup();

    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });

    return user;
};

const renderPane = (versionNumber = 2) =>
    renderWithProviders(
        <ArtifactPane isVisible agentId="agent-1" artifact={pointer(versionNumber)} openNonce={1} onClose={onClose} />,
    );

const paneHeader = (): HTMLElement => {
    const header = document.querySelector('.artifact-pane-header');

    if (!(header instanceof HTMLElement)) throw new Error('The artifact pane header is not rendered.');

    return header;
};

const paneRoot = (): HTMLElement => {
    const root = document.querySelector('[data-slot="artifact-pane"]');

    if (!(root instanceof HTMLElement)) throw new Error('The artifact pane is not rendered.');

    return root;
};

const openVersionMenu = async (user: ReturnType<typeof userEvent.setup>, label: string | RegExp) => {
    await user.click(await screen.findByRole('button', { name: label }));

    return screen.findAllByRole('menuitem');
};

describe('ArtifactPane', () => {
    beforeEach(() => {
        onClose.mockClear();
        writeText.mockReset();
        writeText.mockResolvedValue(undefined);
        stubReads();
        window.localStorage.clear();
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 1600 });
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('renders nothing until an artifact is opened', () => {
        const { container } = renderWithProviders(
            <ArtifactPane isVisible={false} agentId="agent-1" artifact={null} openNonce={0} onClose={onClose} />,
        );

        expect(container).toBeEmptyDOMElement();
    });

    it('renders the version the chip published, with the version dropdown reading it', async () => {
        renderPane();

        expect(await screen.findByTestId('markdown')).toHaveTextContent('# Plan v2');
        expect(screen.getByRole('button', { name: /v2/ })).toBeInTheDocument();
    });

    it('keeps the view toggle, the title, the actions and the close button on one header row', async () => {
        renderPane();

        await screen.findByTestId('markdown');

        const header = paneHeader();

        expect(header.className).toContain('flex min-h-12 items-center justify-between gap-3');
        expect(header.className).toContain('border-b border-border bg-card py-2 pr-3 pl-3');

        const [heading, actions] = [...header.children];

        expect(header.children).toHaveLength(2);
        expect(heading.className).toContain('flex min-w-0 flex-1 items-center gap-2');
        expect(within(heading as HTMLElement).getByRole('heading', { level: 4 }).className).toContain(
            'truncate text-base font-semibold tracking-tight text-foreground',
        );

        // Preview/source sits ahead of the title, the shape Claude's artifact header has.
        expect(within(heading as HTMLElement).getByRole('button', { name: 'Preview' })).toBeInTheDocument();
        expect(within(heading as HTMLElement).getByRole('button', { name: 'Source' })).toBeInTheDocument();

        expect(actions.className).toContain('flex shrink-0 items-center gap-1');
        expect(actions.lastElementChild).toHaveAttribute('aria-label', 'Close');
        expect(within(actions as HTMLElement).getByRole('button', { name: /v2/ })).toBeInTheDocument();
        expect(within(actions as HTMLElement).getByRole('button', { name: 'Copy' })).toBeInTheDocument();
        expect(within(actions as HTMLElement).getByRole('button', { name: 'Full screen' })).toBeInTheDocument();
    });

    it('offers no way to edit the source — only the assistant writes an artifact', async () => {
        renderPane();

        await screen.findByTestId('markdown');

        expect(screen.queryByRole('button', { name: 'Edit' })).not.toBeInTheDocument();
        expect(screen.queryByRole('textbox')).not.toBeInTheDocument();
    });

    it('lists every version newest first, with its author and date, and marks the current one', async () => {
        const user = setupUser();

        renderPane();

        const items = await openVersionMenu(user, 'v2');

        expect(items).toHaveLength(3);
        expect(items[0]).toHaveTextContent('v3');
        expect(items[0]).toHaveTextContent('Fizan · Sep 09, 2026');
        expect(items[1]).toHaveTextContent('v2');
        expect(items[1]).toHaveTextContent('Current');
        expect(items[2]).toHaveTextContent('v1');
        expect(items[2]).toHaveTextContent('the assistant · Sep 09, 2026');
        expect(items[0]).not.toHaveTextContent('Current');
    });

    it('shows the version picked from the dropdown, by the number the server listed', async () => {
        const user = setupUser();

        renderPane();

        const items = await openVersionMenu(user, 'v2');

        await user.click(items[2]);

        await waitFor(() => expect(screen.getByTestId('markdown')).toHaveTextContent('# Plan v1'));
        expect(screen.getByRole('button', { name: /v1/ })).toBeInTheDocument();
    });

    it('copies the artifact content from the copy split', async () => {
        const user = setupUser();

        renderPane();

        await user.click(await screen.findByRole('button', { name: 'Copy' }));

        await waitFor(() => expect(writeText).toHaveBeenCalledWith('# Plan v2'));
    });

    it('hangs download off the copy chevron rather than repeating Copy', async () => {
        const user = setupUser();

        renderPane();

        await screen.findByTestId('markdown');
        await user.click(screen.getByRole('button', { name: 'Copy options' }));

        const items = await screen.findAllByRole('menuitem');

        expect(items).toHaveLength(1);
        expect(items[0]).toHaveTextContent('Download as .md');
    });

    it('offers a copy link to the standalone artifact page when the host knows the agent slug', async () => {
        const user = setupUser();

        renderWithProviders(
            <ArtifactPane
                isVisible
                agentId="agent-1"
                agentSlug="foo"
                artifact={pointer(2)}
                openNonce={1}
                onClose={onClose}
            />,
        );

        await screen.findByTestId('markdown');
        await user.click(screen.getByRole('button', { name: 'Copy options' }));
        await user.click(await screen.findByRole('menuitem', { name: 'Copy link' }));

        await waitFor(() =>
            expect(writeText).toHaveBeenCalledWith(
                `${window.location.origin}/agent/foo/artifact/${encodeURIComponent(ARTIFACT_ID)}`,
            ),
        );
    });

    it('hides the copy link when the host has no agent slug to build one from', async () => {
        const user = setupUser();

        renderPane();

        await screen.findByTestId('markdown');
        await user.click(screen.getByRole('button', { name: 'Copy options' }));

        expect(await screen.findAllByRole('menuitem')).toHaveLength(1);
        expect(screen.queryByRole('menuitem', { name: 'Copy link' })).not.toBeInTheDocument();
    });

    it('switches between the source and the preview', async () => {
        const user = setupUser();

        renderPane();

        await user.click(await screen.findByRole('button', { name: 'Source' }));

        expect(await screen.findByText('# Plan v2')).toBeInTheDocument();
        expect(screen.queryByTestId('markdown')).not.toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: 'Preview' }));

        expect(await screen.findByTestId('markdown')).toHaveTextContent('# Plan v2');
    });

    it('goes full screen and back, and leaves full screen on Escape before closing', async () => {
        const user = setupUser();

        renderPane();

        await screen.findByTestId('markdown');

        await user.click(screen.getByRole('button', { name: 'Full screen' }));

        expect(paneRoot()).toHaveAttribute('data-fullscreen', 'true');

        await user.keyboard('{Escape}');

        expect(paneRoot()).not.toHaveAttribute('data-fullscreen');
        expect(onClose).not.toHaveBeenCalled();

        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalled();
    });

    it('resizes the pane from its edge and remembers the width', async () => {
        renderPane();

        await screen.findByTestId('markdown');

        const pane = paneRoot();
        const resizer = screen.getByRole('separator', { name: 'Resize panel' });
        const before = pane.style.width;

        resizer.focus();
        await userEvent.keyboard('{ArrowLeft}');

        expect(pane.style.width).not.toEqual(before);
        expect(window.localStorage.getItem('artifact-pane-width')).toEqual(
            String(Number.parseInt(pane.style.width, 10)),
        );
    });

    it('downloads the source with an extension for its type', async () => {
        const user = setupUser();
        const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

        renderPane();

        await screen.findByTestId('markdown');

        await user.click(screen.getByRole('button', { name: 'Copy options' }));
        await user.click(await screen.findByRole('menuitem', { name: /Download as \.md/ }));

        expect(click).toHaveBeenCalled();

        click.mockRestore();
    });

    it('closes from full screen instead of leaving the overlay covering the app', async () => {
        const user = setupUser();

        renderPane();

        await screen.findByTestId('markdown');
        await user.click(screen.getByRole('button', { name: 'Full screen' }));

        expect(paneRoot()).toHaveAttribute('data-fullscreen', 'true');

        await user.click(screen.getByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalled();
        expect(document.querySelector('[data-fullscreen="true"]')).toBeNull();
    });

    it('names the trigger Latest on the newest version, and by number on an older one', async () => {
        const user = setupUser();

        renderPane(3);

        expect(await screen.findByRole('button', { name: /^Latest/ })).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /of 3/ })).not.toBeInTheDocument();

        const items = await openVersionMenu(user, /^Latest/);

        expect(items[0]).toHaveTextContent('Latest');
        expect(items[0]).toHaveTextContent('Current');
    });

    it('lets the preview fill the dialog, which carries no definite height of its own', async () => {
        renderWithProviders(
            <ArtifactPane
                isVisible
                isFromAdmin
                agentId="agent-1"
                artifact={pointer(2)}
                openNonce={1}
                onClose={onClose}
            />,
        );

        await screen.findByTestId('markdown');

        const document_ = document.querySelector('.artifact-pane-document');

        expect(document_?.className).toContain('relative');
        expect(document_?.firstElementChild?.className).toContain('absolute inset-0');
    });

    it('numbers the source lines so a long artifact can be talked about', async () => {
        const user = setupUser();

        renderPane();

        await user.click(await screen.findByRole('button', { name: 'Source' }));

        const code = await screen.findByTestId('artifact-code');

        expect(within(code).getByText('1')).toBeInTheDocument();
    });

    it('takes over the viewport on a narrow window instead of opening a dialog', async () => {
        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 900 });

        renderPane();

        await screen.findByTestId('markdown');

        const pane = paneRoot();

        expect(pane).toHaveAttribute('data-overlay', 'narrow');
        expect(pane.className).toContain('fixed inset-0');

        // A pane already filling the screen offers no expand control, as Claude's does not.
        expect(screen.queryByRole('button', { name: 'Full screen' })).not.toBeInTheDocument();

        // It is a flush panel, not a centred modal card.
        expect(document.querySelector('[role="dialog"]')).toBeNull();
    });

    it('closes on Escape from the narrow takeover, with no pane to step back to', async () => {
        const user = setupUser();

        Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: 900 });

        renderPane();

        await screen.findByTestId('markdown');
        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalled();
    });

    it('closes on the close affordance', async () => {
        renderPane();

        await userEvent.click(await screen.findByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalled();
    });
});
