import { http } from 'msw';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, httpError, server } from '@/test/msw';
import { renderWithProviders, screen } from '@/test/test-utils';

import ArtifactPage from './artifact-page';

vi.mock('@/components/markdown', () => ({
    default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
    MermaidDiagram: () => null,
    CARD_PROSE_CLASS_NAME: 'prose',
}));

const ARTIFACT_ID = 'conv-1:plan';

const agentDocument = {
    _id: 'agent-1',
    name: 'Scout',
    slug: 'scout',
    uiConfig: { type: 'chat' },
};

const headDocument = {
    artifact_id: ARTIFACT_ID,
    agent_id: 'agent-1',
    conversation_id: 'conv-1',
    slug: 'plan',
    title: 'Launch plan',
    artifact_type: 'markdown',
    latest_version: 2,
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
    author_kind: 'user',
    author_id: 'user-1',
    author_name: 'Fizan',
    restored_from_version: null,
    created_at: '2026-09-09T10:00:00.000Z',
    content: `# Plan v${versionNumber}`,
});

const fileDocument = (overrides: Record<string, unknown> = {}) => ({
    _id: ARTIFACT_ID,
    name: 'plan',
    extension: '.artifact',
    origin: 'artifact',
    creator_id: 'user-1',
    creator_name: null,
    is_public: false,
    likes: [],
    likes_count: 0,
    artifact_versions: [],
    ...overrides,
});

const stubFile = (overrides: Record<string, unknown> = {}) => {
    server.use(http.get(apiUrl('/files/:fileId'), () => envelope(fileDocument(overrides))));
};

const requestedIds: string[] = [];

const stubReads = () => {
    server.use(
        http.get(apiUrl('/agents/:agentId'), () => envelope(agentDocument)),
        http.get(apiUrl(`/ai/artifacts/${encodeURIComponent(ARTIFACT_ID)}`), () => {
            requestedIds.push(ARTIFACT_ID);

            return envelope(headDocument);
        }),
        http.get(apiUrl(`/ai/artifacts/${encodeURIComponent(ARTIFACT_ID)}/versions`), () =>
            envelope([versionDocument(2), versionDocument(1)]),
        ),
        http.get(apiUrl(`/ai/artifacts/${encodeURIComponent(ARTIFACT_ID)}/versions/:versionNumber`), ({ params }) =>
            envelope(versionDocument(Number(params.versionNumber))),
        ),
    );

    stubFile();
};

const ChatShell = () => <div data-testid="chat-shell">conversation sidebar</div>;

const renderPage = (path: string) =>
    renderWithProviders(
        <Routes>
            <Route path="agent/:agentId/*" element={<ChatShell />} />
            <Route path="agent/:agentId/artifact/:artifactId" element={<ArtifactPage />} />
        </Routes>,
        { route: path },
    );

describe('ArtifactPage', () => {
    beforeEach(() => {
        requestedIds.length = 0;
        stubReads();
    });

    it('wins over the agent wildcard route, so the chat shell never mounts', async () => {
        renderPage(`/agent/scout/artifact/${encodeURIComponent(ARTIFACT_ID)}`);

        expect(await screen.findByRole('heading', { name: 'Launch plan' })).toBeInTheDocument();
        expect(screen.queryByTestId('chat-shell')).not.toBeInTheDocument();
    });

    it('renders the artifact title and its latest content', async () => {
        renderPage(`/agent/scout/artifact/${encodeURIComponent(ARTIFACT_ID)}`);

        expect(await screen.findByRole('heading', { name: 'Launch plan' })).toBeInTheDocument();
        expect(await screen.findByTestId('markdown')).toHaveTextContent('# Plan v2');
        expect(screen.getByText('launch-plan.md')).toBeInTheDocument();
    });

    it('resolves a percent-encoded artifact id from the path', async () => {
        renderPage('/agent/scout/artifact/conv-1%3Aplan');

        expect(await screen.findByTestId('markdown')).toHaveTextContent('# Plan v2');
        expect(requestedIds).toContain(ARTIFACT_ID);
    });

    it('shows the unavailable state when the artifact cannot be read', async () => {
        server.use(
            http.get(apiUrl(`/ai/artifacts/${encodeURIComponent(ARTIFACT_ID)}`), () => httpError(404, 'Not found')),
        );

        renderPage(`/agent/scout/artifact/${encodeURIComponent(ARTIFACT_ID)}`);

        expect(await screen.findByRole('heading', { name: 'Document not available' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to Scout' })).toHaveAttribute('href', '/agent/scout');
    });

    it('offers no back-to-conversation control', async () => {
        renderPage(`/agent/scout/artifact/${encodeURIComponent(ARTIFACT_ID)}`);

        await screen.findByRole('heading', { name: 'Launch plan' });

        expect(screen.queryByRole('link', { name: /back to conversation/i })).not.toBeInTheDocument();
    });

    it('shows an agent-not-found state when the agent cannot be read', async () => {
        server.use(http.get(apiUrl('/agents/:agentId'), () => httpError(404, 'Not found')));

        renderPage(`/agent/scout/artifact/${encodeURIComponent(ARTIFACT_ID)}`);

        expect(await screen.findByRole('heading', { name: 'Agent not available' })).toBeInTheDocument();
        expect(screen.getByRole('link', { name: 'Back to home' })).toHaveAttribute('href', '/');
    });

    it('marks a private artifact Private in the top bar, with no control to change it', async () => {
        renderPage(`/agent/scout/artifact/${encodeURIComponent(ARTIFACT_ID)}`);

        expect(await screen.findByText('Private')).toBeInTheDocument();
        expect(screen.queryByText('Public')).not.toBeInTheDocument();
        expect(screen.queryByRole('radiogroup')).not.toBeInTheDocument();
        expect(screen.queryByRole('switch')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: 'Public' })).not.toBeInTheDocument();
    });

    it('marks a public artifact Public', async () => {
        stubFile({ is_public: true });

        renderPage(`/agent/scout/artifact/${encodeURIComponent(ARTIFACT_ID)}`);

        expect(await screen.findByText('Public')).toBeInTheDocument();
    });

    it('shows the like control with the stored count and liked state', async () => {
        stubFile({ likes: ['user-1'], likes_count: 7 });

        renderPage(`/agent/scout/artifact/${encodeURIComponent(ARTIFACT_ID)}`);

        const like = await screen.findByRole('button', { name: 'Unlike' });

        expect(like).toHaveAttribute('aria-pressed', 'true');
        expect(like).toHaveTextContent('7');
    });

    it('hides the like control for a non-creator on a private artifact', async () => {
        stubFile({ creator_id: 'user-2' });

        renderPage(`/agent/scout/artifact/${encodeURIComponent(ARTIFACT_ID)}`);

        expect(await screen.findByText('Private')).toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^(Like|Unlike)$/ })).not.toBeInTheDocument();
    });

    it('renders the document without either decoration when the file document cannot be read', async () => {
        server.use(http.get(apiUrl('/files/:fileId'), () => httpError(404, 'Not found')));

        renderPage(`/agent/scout/artifact/${encodeURIComponent(ARTIFACT_ID)}`);

        expect(await screen.findByTestId('markdown')).toHaveTextContent('# Plan v2');
        expect(screen.queryByText('Private')).not.toBeInTheDocument();
        expect(screen.queryByText('Public')).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /^(Like|Unlike)$/ })).not.toBeInTheDocument();
    });
});
