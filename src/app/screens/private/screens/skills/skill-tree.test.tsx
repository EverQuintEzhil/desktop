import { screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, httpError, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import SkillTree from './skill-tree';

const ROOT = 'skills/skill-1/';

const entry = (path: string, overrides: Record<string, unknown> = {}) => ({
    path: `${ROOT}${path}`,
    ...overrides,
});

const stubFiles = (byFolder: Record<string, unknown[]>) => {
    server.use(
        http.get(apiUrl('/skills/skill-1/files'), ({ request }) => {
            const folder = new URL(request.url).searchParams.get('folder') ?? '';

            return envelope(byFolder[folder] ?? []);
        }),
    );
};

const renderTree = (selectedFile: string | null = null) => {
    const onSelectFile = vi.fn();

    const view = renderWithProviders(
        <SkillTree skillId="skill-1" selectedFile={selectedFile} onSelectFile={onSelectFile} />,
    );

    return { ...view, onSelectFile };
};

describe('SkillTree', () => {
    it('shows a loading row before the root listing arrives', () => {
        stubFiles({ '': [] });
        renderTree();

        expect(screen.getByText('Loading files...')).toBeInTheDocument();
    });

    it('lists the root files with the skill prefix stripped', async () => {
        stubFiles({ '': [entry('SKILL.md'), entry('notes.md')] });
        renderTree();

        expect(await screen.findByRole('button', { name: /SKILL\.md/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /notes\.md/ })).toBeInTheDocument();
    });

    it('sorts folders above files and alphabetises within each group', async () => {
        stubFiles({
            '': [
                entry('zebra.md'),
                entry('assets/', { metadata: { isFolder: true } }),
                entry('alpha.md'),
                entry('references/', { kind: 'folder' }),
            ],
        });
        renderTree();

        await screen.findByRole('button', { name: /alpha\.md/ });

        const labels = screen.getAllByRole('button').map((button) => button.textContent?.trim());

        expect(labels).toEqual(['assets', 'references', 'alpha.md', 'zebra.md']);
    });

    it('reports a failed root listing', async () => {
        server.use(respond('get', '/skills/skill-1/files', () => httpError(500)));
        renderTree();

        expect(await screen.findByText('Failed to load files')).toBeInTheDocument();
    });

    it('selects a file rather than expanding it', async () => {
        const user = userEvent.setup();

        stubFiles({ '': [entry('notes.md')] });
        const { onSelectFile } = renderTree();

        await user.click(await screen.findByRole('button', { name: /notes\.md/ }));

        expect(onSelectFile).toHaveBeenCalledWith('notes.md');
    });

    it('fetches a folder the first time it is expanded and shows its children', async () => {
        const user = userEvent.setup();
        const folders: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/skills/skill-1/files'), ({ request }) => {
                const folder = new URL(request.url).searchParams.get('folder') ?? '';

                folders.push(folder);

                if (folder === 'assets') {
                    return envelope([entry('assets/logo.png')]);
                }

                return envelope([entry('assets/', { metadata: { isFolder: true } })]);
            }),
        );

        renderTree();

        await user.click(await screen.findByRole('button', { name: /assets/ }));

        expect(await screen.findByRole('button', { name: /logo\.png/ })).toBeInTheDocument();
        expect(folders).toContain('assets');
    });

    it('collapses an expanded folder and re-expands it', async () => {
        const user = userEvent.setup();

        server.use(
            http.get(apiUrl('/skills/skill-1/files'), ({ request }) => {
                const folder = new URL(request.url).searchParams.get('folder') ?? '';

                if (folder === 'assets') {
                    return envelope([entry('assets/logo.png')]);
                }

                return envelope([entry('assets/', { metadata: { isFolder: true } })]);
            }),
        );

        renderTree();

        const folder = await screen.findByRole('button', { name: /assets/ });

        await user.click(folder);
        await screen.findByRole('button', { name: /logo\.png/ });

        await user.click(folder);

        await waitFor(() => {
            expect(screen.queryByRole('button', { name: /logo\.png/ })).not.toBeInTheDocument();
        });

        await user.click(folder);

        expect(await screen.findByRole('button', { name: /logo\.png/ })).toBeInTheDocument();
    });

    it('marks the selected file', async () => {
        stubFiles({ '': [entry('notes.md'), entry('other.md')] });
        renderTree('notes.md');

        const selected = await screen.findByRole('button', { name: /notes\.md/ });

        expect(selected.className).toContain('bg-primary/10 text-primary');
        expect(screen.getByRole('button', { name: /other\.md/ }).className).toContain('text-muted-foreground');
    });

    it('treats an entry that is already relative as-is', async () => {
        stubFiles({ '': [{ path: 'loose.md' }] });
        renderTree();

        expect(await screen.findByRole('button', { name: /loose\.md/ })).toBeInTheDocument();
    });
});
