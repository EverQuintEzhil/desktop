import { act, screen } from '@testing-library/react';
import { delay, http } from 'msw';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { SkillType } from '@/types/admin';

import SkillEditorPane from './skill-editor-pane';

const { showErrorToast } = vi.hoisted(() => ({ showErrorToast: vi.fn() }));

vi.mock('@/utils', async (importOriginal) => ({
    ...(await importOriginal<typeof import('@/utils')>()),
    showErrorToast,
}));

const skill = {
    _id: 'skill-1',
    name: 'Brand voice',
    creator: { _id: 'user-1', name: { first: 'Test', last: 'User' } },
    updatedAt: '2026-03-04T12:00:00.000Z',
} as unknown as SkillType;

const SLOW_FILE_MS = 60;

/**
 * `getFile` and `getFiles` share `GET /skills/:id/files`; the `path` param is what
 * distinguishes a single-file read from a folder listing.
 */
const stubSkill = (contentByPath: Record<string, string>, slowPath?: string) => {
    server.use(
        http.get(apiUrl('/skills/skill-1'), () => envelope(skill)),
        http.get(apiUrl('/skills/skill-1/files'), async ({ request }) => {
            const path = new URL(request.url).searchParams.get('path');

            if (!path) return envelope([]);

            if (path === slowPath) await delay(SLOW_FILE_MS);

            return envelope({ path, content: contentByPath[path] ?? '' });
        }),
    );
};

const renderPane = (selectedFile: string | null) =>
    renderWithProviders(<SkillEditorPane skillId="skill-1" selectedFile={selectedFile} onSelectFile={vi.fn()} />);

const settleSlowFile = () =>
    act(async () => {
        await new Promise((resolve) => {
            setTimeout(resolve, SLOW_FILE_MS * 3);
        });
    });

beforeEach(() => {
    showErrorToast.mockClear();
});

describe('SkillEditorPane file loading', () => {
    it('renders the selected file content', async () => {
        stubSkill({ 'notes.md': 'Notes body' });

        renderPane('notes.md');

        expect(await screen.findByText('Notes body')).toBeInTheDocument();
    });

    it('keeps the newer file content when a slower earlier request resolves last', async () => {
        stubSkill({ 'alpha.md': 'Alpha body', 'bravo.md': 'Bravo body' }, 'alpha.md');

        const { rerender } = renderPane('alpha.md');

        rerender(<SkillEditorPane skillId="skill-1" selectedFile="bravo.md" onSelectFile={vi.fn()} />);

        expect(await screen.findByText('Bravo body')).toBeInTheDocument();

        await settleSlowFile();

        expect(screen.getByText('Bravo body')).toBeInTheDocument();
        expect(screen.queryByText('Alpha body')).not.toBeInTheDocument();
    });

    // Guards the isCancel branch, not the race — it also passes without the abort, because a
    // successful late response never toasted either. The test above is the discriminating one.
    it('does not toast when a superseded request rejects as cancelled', async () => {
        stubSkill({ 'alpha.md': 'Alpha body', 'bravo.md': 'Bravo body' }, 'alpha.md');

        const { rerender } = renderPane('alpha.md');

        rerender(<SkillEditorPane skillId="skill-1" selectedFile="bravo.md" onSelectFile={vi.fn()} />);

        await screen.findByText('Bravo body');
        await settleSlowFile();

        expect(showErrorToast).not.toHaveBeenCalled();
    });
});
