import { screen, waitFor, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, httpError, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import SkillEdit from './skill-edit';

const OWNER = { _id: 'user-1', name: { first: 'Test', last: 'User' } };

const skill = (overrides: Record<string, unknown> = {}) => ({
    _id: 'skill-1',
    name: 'Weekly report',
    description: 'Turns recent work into a status update.',
    creator: OWNER,
    ...overrides,
});

const stubSkill = (value: Record<string, unknown> = skill()) => {
    server.use(respond('get', '/skills/skill-1', () => envelope(value)));
    server.use(respond('get', '/skills/skill-1/files', () => envelope({ folders: [], files: [] })));
};

/**
 * A rename that has to reach the server. Used to give the "nothing was written"
 * tests a positive signal to settle on: the recorded bodies then have to be
 * exactly this one write.
 */
const renameTo = async (user: UserEvent, input: HTMLElement, name: string) => {
    await user.click(input);
    await user.clear(input);
    await user.type(input, name);
    await user.tab();
};

const renderEdit = (props: Partial<Parameters<typeof SkillEdit>[0]> = {}) => {
    const onBack = vi.fn();
    const onDeleted = vi.fn();
    const onUpdated = vi.fn();

    const view = renderWithProviders(
        <SkillEdit skillId="skill-1" onBack={onBack} onDeleted={onDeleted} onUpdated={onUpdated} {...props} />,
    );

    return {
        ...view,
        onBack,
        onDeleted,
        onUpdated,
    };
};

describe('SkillEdit', () => {
    it('shows a loading state before the skill arrives', () => {
        stubSkill();
        renderEdit();

        expect(screen.getByText('Loading skill...')).toBeInTheDocument();
    });

    it('renders the name and description once loaded', async () => {
        stubSkill();
        renderEdit();

        expect(await screen.findByLabelText('Skill name')).toHaveValue('Weekly report');
        expect(screen.getByText('Turns recent work into a status update.')).toBeInTheDocument();
    });

    it('offers a way back when the skill cannot be loaded', async () => {
        const user = userEvent.setup();

        server.use(respond('get', '/skills/skill-1', () => httpError(500)));

        const { onBack } = renderEdit();

        expect(await screen.findByText('Failed to load skill details.')).toBeInTheDocument();

        await user.click(screen.getByRole('button', { name: /Go Back/ }));

        expect(onBack).toHaveBeenCalled();
    });

    it('goes back from the header button', async () => {
        const user = userEvent.setup();

        stubSkill();
        const { onBack } = renderEdit();

        await user.click(await screen.findByRole('button', { name: 'Back to skills' }));

        expect(onBack).toHaveBeenCalled();
    });

    it('hides the header back button when asked', async () => {
        stubSkill();
        renderEdit({ showTitleBackButton: false });

        await screen.findByLabelText('Skill name');
        expect(screen.queryByRole('button', { name: 'Back to skills' })).not.toBeInTheDocument();
    });

    it('renames the skill on blur, sending only the name', async () => {
        const user = userEvent.setup();
        let body: unknown;

        stubSkill();
        server.use(
            http.put(apiUrl('/skills/skill-1'), async ({ request }) => {
                body = await request.json();

                return envelope(skill({ name: 'Renamed' }));
            }),
        );

        const { onUpdated } = renderEdit();

        const input = await screen.findByLabelText('Skill name');

        await user.clear(input);
        await user.type(input, '  Renamed  ');
        await user.tab();

        await waitFor(() => {
            expect(body).toEqual({ name: 'Renamed' });
        });
        expect(onUpdated).toHaveBeenCalledWith({ _id: 'skill-1', name: 'Renamed' });
    });

    it('restores the old name when the field is emptied', async () => {
        const user = userEvent.setup();
        const bodies: unknown[] = [];

        stubSkill();
        server.use(
            http.put(apiUrl('/skills/skill-1'), async ({ request }) => {
                bodies.push(await request.json());

                return envelope(skill());
            }),
        );

        renderEdit();

        const input = await screen.findByLabelText('Skill name');

        await user.clear(input);
        await user.tab();

        await waitFor(() => {
            expect(input).toHaveValue('Weekly report');
        });

        await renameTo(user, input, 'Deliberate');

        await waitFor(() => {
            expect(bodies).toEqual([{ name: 'Deliberate' }]);
        });
    });

    it('does not save a name that did not change', async () => {
        const user = userEvent.setup();
        const bodies: unknown[] = [];

        stubSkill();
        server.use(
            http.put(apiUrl('/skills/skill-1'), async ({ request }) => {
                bodies.push(await request.json());

                return envelope(skill());
            }),
        );

        renderEdit();

        const input = await screen.findByLabelText('Skill name');

        await user.click(input);
        await user.tab();

        await renameTo(user, input, 'Deliberate');

        await waitFor(() => {
            expect(bodies).toEqual([{ name: 'Deliberate' }]);
        });
    });

    it('rolls the name back when the rename request fails', async () => {
        const user = userEvent.setup();

        stubSkill();
        server.use(respond('put', '/skills/skill-1', () => httpError(500)));

        const { onUpdated } = renderEdit();

        const input = await screen.findByLabelText('Skill name');

        await user.clear(input);
        await user.type(input, 'Renamed');
        await user.tab();

        await waitFor(() => {
            expect(input).toHaveValue('Weekly report');
        });
        expect(onUpdated).not.toHaveBeenCalled();
    });

    it('reverts the name draft on Escape', async () => {
        const user = userEvent.setup();
        const bodies: unknown[] = [];

        stubSkill();
        server.use(
            http.put(apiUrl('/skills/skill-1'), async ({ request }) => {
                bodies.push(await request.json());

                return envelope(skill());
            }),
        );

        renderEdit();

        const input = await screen.findByLabelText('Skill name');

        await user.clear(input);
        await user.type(input, 'Scratch{Escape}');

        await waitFor(() => {
            expect(input).toHaveValue('Weekly report');
        });

        // Escape restores the draft synchronously, so the wait above settles
        // before any request could land. A deliberate rename afterwards gives the
        // endpoint a write that must happen in both worlds — the abandoned
        // 'Scratch' can then only show up as an extra body.
        await renameTo(user, input, 'Deliberate');

        await waitFor(() => {
            expect(bodies).toEqual([{ name: 'Deliberate' }]);
        });
    });

    it('edits the description in place and saves it on blur', async () => {
        const user = userEvent.setup();
        let body: unknown;

        stubSkill();
        server.use(
            http.put(apiUrl('/skills/skill-1'), async ({ request }) => {
                body = await request.json();

                return envelope(skill({ description: 'Shorter' }));
            }),
        );

        renderEdit();

        await user.click(await screen.findByText('Turns recent work into a status update.'));

        const textarea = await screen.findByLabelText('Skill description');

        await user.clear(textarea);
        await user.type(textarea, 'Shorter');
        await user.tab();

        await waitFor(() => {
            expect(body).toEqual({ description: 'Shorter' });
        });
    });

    it('discards the description draft on Escape', async () => {
        const user = userEvent.setup();
        const bodies: unknown[] = [];

        stubSkill();
        server.use(
            http.put(apiUrl('/skills/skill-1'), async ({ request }) => {
                bodies.push(await request.json());

                return envelope(skill());
            }),
        );

        renderEdit();

        await user.click(await screen.findByText('Turns recent work into a status update.'));

        const textarea = await screen.findByLabelText('Skill description');

        await user.clear(textarea);
        await user.type(textarea, 'Scratch{Escape}');

        await waitFor(() => {
            expect(screen.queryByLabelText('Skill description')).not.toBeInTheDocument();
        });

        // Same reasoning as the name field: settle on a write that has to happen.
        await user.click(await screen.findByText('Turns recent work into a status update.'));

        const reopened = await screen.findByLabelText('Skill description');

        await user.clear(reopened);
        await user.type(reopened, 'Deliberate');
        await user.tab();

        await waitFor(() => {
            expect(bodies).toEqual([{ description: 'Deliberate' }]);
        });
    });

    it('keeps a non-owner out of the inline editors', async () => {
        const user = userEvent.setup();

        stubSkill(skill({ creator: { _id: 'someone-else' } }));
        renderEdit();

        await user.click(await screen.findByText('Turns recent work into a status update.'));

        expect(screen.queryByLabelText('Skill description')).not.toBeInTheDocument();
        expect(screen.queryByLabelText('Skill name')).not.toBeInTheDocument();
    });

    it('deletes an owned skill and reports the id back', async () => {
        const user = userEvent.setup();

        stubSkill();
        server.use(respond('delete', '/skills/skill-1', () => envelope(null)));

        const { onDeleted } = renderEdit();

        await user.click(await screen.findByRole('button', { name: 'Skill actions' }));
        await user.click(await screen.findByRole('menuitem', { name: /Delete skill/ }));

        const dialog = await screen.findByRole('alertdialog');

        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(onDeleted).toHaveBeenCalledWith('skill-1');
        });
    });

    it('keeps the skill when the delete fails', async () => {
        const user = userEvent.setup();
        let attempts = 0;

        stubSkill();
        server.use(
            respond('delete', '/skills/skill-1', () => {
                attempts += 1;

                return httpError(500);
            }),
        );

        const { onDeleted } = renderEdit();

        await user.click(await screen.findByRole('button', { name: 'Skill actions' }));
        await user.click(await screen.findByRole('menuitem', { name: /Delete skill/ }));

        const dialog = await screen.findByRole('alertdialog');

        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(attempts).toBe(1);
        });
        expect(screen.getByRole('alertdialog')).toBeInTheDocument();
        expect(onDeleted).not.toHaveBeenCalled();
    });

    it('hides Delete for a skill the user does not own', async () => {
        const user = userEvent.setup();

        stubSkill(skill({ creator: { _id: 'someone-else' } }));
        renderEdit();

        await user.click(await screen.findByRole('button', { name: 'Skill actions' }));

        expect(await screen.findByRole('menuitem', { name: /Download skill/ })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: /Delete skill/ })).not.toBeInTheDocument();
    });
});
