import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, server } from '@/test/msw';
import { renderWithProviders, screen } from '@/test/test-utils';

import { ArtifactChip } from './artifact-chip';
import type { ArtifactPointer } from './artifact-types';

const onShowArtifact = vi.fn();

vi.mock('../view/chat-view-context', () => ({
    useChatViewContext: () => ({ agent: { _id: 'agent-1' }, onShowArtifact, activeArtifactId: null }),
}));

const ARTIFACT_ID = 'conv-1:landing';

const pointer = (overrides: Partial<ArtifactPointer> = {}): ArtifactPointer => ({
    toolCallId: 'call-1',
    artifactId: ARTIFACT_ID,
    slug: 'landing',
    title: 'Landing page',
    artifactType: 'html',
    language: null,
    versionNumber: 2,
    ...overrides,
});

const HTML_CONTENT = [
    '<!doctype html>',
    '<html><head><title>Landing page</title><style>body { color: red; }</style></head>',
    '<body><h1>Quarterly review</h1><p>Revenue grew by a fifth.</p></body></html>',
].join('\n');

const stubVersion = (content: string, artifactType: string) => {
    server.use(
        http.get(apiUrl(`/ai/artifacts/${encodeURIComponent(ARTIFACT_ID)}/versions/:versionNumber`), ({ params }) =>
            envelope({
                artifact_id: ARTIFACT_ID,
                version_number: Number(params.versionNumber),
                title: 'Landing page',
                artifact_type: artifactType,
                content_bytes: content.length,
                author_kind: 'model',
                author_id: 'user-1',
                author_name: null,
                restored_from_version: null,
                created_at: '2026-09-09T10:00:00.000Z',
                content,
            }),
        ),
    );
};

describe('ArtifactChip', () => {
    beforeEach(() => {
        onShowArtifact.mockClear();
    });

    it('names the artifact, its type and the version the turn published', () => {
        stubVersion(HTML_CONTENT, 'html');

        renderWithProviders(<ArtifactChip pointer={pointer()} />);

        expect(screen.getByText('Landing page')).toBeInTheDocument();
        expect(screen.getByText('Web page · v2')).toBeInTheDocument();
    });

    it('thumbnails a page with its readable copy, not its markup or stylesheet', async () => {
        stubVersion(HTML_CONTENT, 'html');

        renderWithProviders(<ArtifactChip pointer={pointer()} />);

        const thumbnail = await screen.findByText(/Quarterly review/);

        expect(thumbnail).toHaveTextContent('Revenue grew by a fifth.');
        expect(thumbnail).not.toHaveTextContent('color: red');
        expect(thumbnail).not.toHaveTextContent('doctype');
    });

    it('thumbnails a text document with its own opening source', async () => {
        stubVersion('# Launch plan\n\nShip on Friday.', 'markdown');

        renderWithProviders(<ArtifactChip pointer={pointer({ artifactType: 'markdown' })} />);

        expect(await screen.findByText(/# Launch plan/)).toHaveTextContent('Ship on Friday.');
    });

    it('opens the artifact pane on the pointer it was given', async () => {
        stubVersion(HTML_CONTENT, 'html');

        renderWithProviders(<ArtifactChip pointer={pointer()} />);

        await userEvent.click(screen.getByRole('button'));

        expect(onShowArtifact).toHaveBeenCalledWith(pointer());
    });
});
