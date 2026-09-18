import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http } from 'msw';
import { useState } from 'react';
import { describe, expect, it, vi } from 'vitest';

import { installPointerCaptureShims, installRichTextDomShims } from '@/test/dom-shims';
import { apiUrl, envelope, httpError, rawPaged, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';

import { SkillsPickerModal } from './skills-picker-modal';

installRichTextDomShims();
installPointerCaptureShims();

const OWNER = { _id: 'user-1', name: { first: 'Test', last: 'User' } };

const skill = (id: string, name: string, overrides: Record<string, unknown> = {}) => ({
    _id: id,
    name,
    description: `${name} description`,
    creator: OWNER,
    ...overrides,
});

const stubFiles = (id = 'skill-1') => {
    server.use(
        respond('get', `/skills/${id}/files`, () =>
            envelope({
                folders: [],
                files: [{ path: 'skill.md', isFolder: false, content: '# Skill' }],
            }),
        ),
    );
};

const stubList = (values: unknown[] = [skill('skill-1', 'Weekly report')]) => {
    server.use(respond('get', '/skills', () => envelope(rawPaged(values))));
};

interface RenderOptions {
    selectedSkills?: { _id: string; name: string; isRecommended?: boolean }[];
    initialViewSkillId?: string | null;
    open?: boolean;
    withUpdate?: boolean;
}

const renderModal = ({
    selectedSkills = [],
    initialViewSkillId = null,
    open = true,
    withUpdate = false,
}: RenderOptions = {}) => {
    const onClose = vi.fn();
    const onToggle = vi.fn();
    const onUpdate = vi.fn();
    const onGenerateSkill = vi.fn();

    const view = renderWithProviders(
        <SkillsPickerModal
            open={open}
            onClose={onClose}
            selectedSkills={selectedSkills}
            onToggle={onToggle}
            onUpdate={withUpdate ? onUpdate : undefined}
            onGenerateSkill={onGenerateSkill}
            initialViewSkillId={initialViewSkillId}
        />,
    );

    return {
        ...view,
        onClose,
        onToggle,
        onUpdate,
        onGenerateSkill,
    };
};

// `open` is driven by real state, unlike `renderModal`: with a fixed `open` prop the dialog
// stays mounted whatever Radix decides, and "the dialog is still open" would pass vacuously.
const renderStatefulModal = () => {
    const onClose = vi.fn();
    const onToggle = vi.fn();
    const onGenerateSkill = vi.fn();

    const Harness = () => {
        const [open, setOpen] = useState(true);

        return (
            <SkillsPickerModal
                open={open}
                onClose={() => {
                    onClose();
                    setOpen(false);
                }}
                selectedSkills={[]}
                onToggle={onToggle}
                onGenerateSkill={onGenerateSkill}
                initialViewSkillId={null}
            />
        );
    };

    const view = renderWithProviders(<Harness />);

    return { ...view, onClose };
};

// The slash popup is portalled to `document.body` by `createSuggestionRender`, outside the
// dialog, so it is found by class rather than by role.
const findSlashPopup = () =>
    waitFor(() => {
        const popup = document.querySelector('.ca-suggest__popover');

        if (!popup) throw new Error('slash popup never opened');

        return popup as HTMLElement;
    });

const openSlashPopup = async (user: ReturnType<typeof userEvent.setup>) => {
    const editor = document.querySelector('.ca-instr-editor');

    if (!editor) throw new Error('instructions editor never mounted');

    await user.click(editor);
    await user.keyboard('/');

    return findSlashPopup();
};

describe('SkillsPickerModal', () => {
    it('renders nothing while closed', () => {
        stubList();
        renderModal({ open: false });

        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('lists skills alongside the generate, add and upload actions', async () => {
        stubList([skill('skill-1', 'Weekly report'), skill('skill-2', 'Meeting notes')]);
        renderModal();

        expect(await screen.findByRole('button', { name: /Weekly report/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Meeting notes/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Generate skill/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: /Add skill/ })).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Upload skill' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Write skill instructions' })).toBeInTheDocument();
    });

    it('requests the first page at the picker page size', async () => {
        let requestUrl = '';

        server.use(
            http.get(apiUrl('/skills'), ({ request }) => {
                requestUrl = request.url;

                return envelope(rawPaged([skill('skill-1', 'Weekly report')]));
            }),
        );

        renderModal();

        await screen.findByRole('button', { name: /Weekly report/ });

        const params = new URL(requestUrl).searchParams;

        expect(params.get('size')).toBe('100');
        expect(params.get('page')).toBe('0');
    });

    it('shows the empty state when there are no skills', async () => {
        stubList([]);
        renderModal();

        expect(await screen.findByText('No skills found')).toBeInTheDocument();
    });

    it('surfaces a list error', async () => {
        server.use(respond('get', '/skills', () => httpError(500)));
        renderModal();

        expect(await screen.findByText(/Request failed with status code 500/)).toBeInTheDocument();
    });

    it('surfaces a success:false envelope as its message', async () => {
        server.use(
            respond('get', '/skills', () =>
                Response.json({
                    success: false,
                    message: 'Skills service unavailable',
                    value: null,
                }),
            ),
        );
        renderModal();

        expect(await screen.findByText('Skills service unavailable')).toBeInTheDocument();
    });

    it('debounces the search box into the list request', async () => {
        const user = userEvent.setup();
        const searches: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/skills'), ({ request }) => {
                searches.push(new URL(request.url).searchParams.get('search'));

                return envelope(rawPaged([skill('skill-1', 'Weekly report')]));
            }),
        );

        renderModal();

        await screen.findByRole('button', { name: /Weekly report/ });
        await user.type(screen.getByLabelText('Search skills'), 'weekly');

        await waitFor(() => {
            expect(searches).toContain('weekly');
        });
        expect(searches.filter((term) => term === 'weekly')).toHaveLength(1);
    });

    it('clears the search term from the inline button', async () => {
        const user = userEvent.setup();

        stubList();
        renderModal();

        const input = await screen.findByLabelText('Search skills');

        await user.type(input, 'weekly');
        await user.click(screen.getByRole('button', { name: 'Clear search' }));

        expect(input).toHaveValue('');
    });

    it('groups already-selected skills above the rest', async () => {
        stubList([skill('skill-1', 'Weekly report'), skill('skill-2', 'Meeting notes')]);
        renderModal({ selectedSkills: [{ _id: 'skill-1', name: 'Weekly report' }] });

        expect(await screen.findByText('Selected Skills')).toBeInTheDocument();
        expect(screen.getByText('Skills')).toBeInTheDocument();
    });

    it('opens the detail pane and fetches the full skill', async () => {
        const user = userEvent.setup();

        stubList();
        stubFiles();
        server.use(
            respond('get', '/skills/skill-1', () =>
                envelope(
                    skill('skill-1', 'Weekly report', {
                        description: 'Turns recent work into a status update.',
                    }),
                ),
            ),
        );

        renderModal();

        await user.click(await screen.findByRole('button', { name: /Weekly report/ }));

        expect(await screen.findByRole('heading', { name: 'Weekly report' })).toBeInTheDocument();
        expect(await screen.findByText('Turns recent work into a status update.')).toBeInTheDocument();
    });

    it('opens straight into a detail pane for an initial skill id', async () => {
        stubList();
        stubFiles();
        server.use(respond('get', '/skills/skill-1', () => envelope(skill('skill-1', 'Weekly report'))));

        renderModal({ initialViewSkillId: 'skill-1' });

        expect(await screen.findByRole('heading', { name: 'Weekly report' })).toBeInTheDocument();
    });

    it('enables the skill from the detail footer', async () => {
        const user = userEvent.setup();

        stubList();
        stubFiles();
        server.use(respond('get', '/skills/skill-1', () => envelope(skill('skill-1', 'Weekly report'))));

        const { onToggle } = renderModal();

        await user.click(await screen.findByRole('button', { name: /Weekly report/ }));
        await user.click(await screen.findByRole('button', { name: 'Enable' }));

        expect(onToggle).toHaveBeenCalledWith({ _id: 'skill-1', name: 'Weekly report' });
    });

    it('offers Remove for an already-selected skill', async () => {
        const user = userEvent.setup();

        stubList();
        stubFiles();
        server.use(respond('get', '/skills/skill-1', () => envelope(skill('skill-1', 'Weekly report'))));

        renderModal({ selectedSkills: [{ _id: 'skill-1', name: 'Weekly report' }] });

        await user.click((await screen.findAllByRole('button', { name: /Weekly report/ }))[0]);

        expect(await screen.findByRole('button', { name: 'Remove' })).toBeInTheDocument();
    });

    it('marks a selected skill as recommended from the detail footer', async () => {
        const user = userEvent.setup();

        stubList();
        stubFiles();
        server.use(respond('get', '/skills/skill-1', () => envelope(skill('skill-1', 'Weekly report'))));

        const { onUpdate } = renderModal({
            selectedSkills: [{ _id: 'skill-1', name: 'Weekly report' }],
            withUpdate: true,
        });

        await user.click((await screen.findAllByRole('button', { name: /Weekly report/ }))[0]);
        await user.click(await screen.findByRole('button', { name: 'Set as recommended' }));

        expect(onUpdate).toHaveBeenCalledWith({ _id: 'skill-1', name: 'Weekly report', isRecommended: true });
    });

    it('clears the recommended flag from an already-recommended skill', async () => {
        const user = userEvent.setup();

        stubList();
        stubFiles();
        server.use(respond('get', '/skills/skill-1', () => envelope(skill('skill-1', 'Weekly report'))));

        const { onUpdate } = renderModal({
            selectedSkills: [{ _id: 'skill-1', name: 'Weekly report', isRecommended: true }],
            withUpdate: true,
        });

        await user.click((await screen.findAllByRole('button', { name: /Weekly report/ }))[0]);
        await user.click(await screen.findByRole('button', { name: 'Recommended' }));

        expect(onUpdate).toHaveBeenCalledWith({ _id: 'skill-1', name: 'Weekly report', isRecommended: false });
    });

    it('hides the recommended control for a skill that is not selected', async () => {
        const user = userEvent.setup();

        stubList();
        stubFiles();
        server.use(respond('get', '/skills/skill-1', () => envelope(skill('skill-1', 'Weekly report'))));

        renderModal({ withUpdate: true });

        await user.click(await screen.findByRole('button', { name: /Weekly report/ }));
        await screen.findByRole('button', { name: 'Enable' });

        expect(screen.queryByRole('button', { name: 'Set as recommended' })).not.toBeInTheDocument();
    });

    it('renames a skill the current user owns and PUTs only the changed field', async () => {
        const user = userEvent.setup();
        let body: unknown;

        stubList();
        stubFiles();
        server.use(respond('get', '/skills/skill-1', () => envelope(skill('skill-1', 'Weekly report'))));
        server.use(
            http.put(apiUrl('/skills/skill-1'), async ({ request }) => {
                body = await request.json();

                return envelope(skill('skill-1', 'Renamed skill'));
            }),
        );

        renderModal();

        await user.click(await screen.findByRole('button', { name: /Weekly report/ }));
        await user.click(await screen.findByRole('button', { name: 'Skill actions' }));
        await user.click(await screen.findByRole('menuitem', { name: /Edit skill/ }));

        const nameInput = await screen.findByLabelText('Skill name');

        await user.clear(nameInput);
        await user.type(nameInput, 'Renamed skill');
        await user.click(screen.getByRole('button', { name: /Save/ }));

        await waitFor(() => {
            expect(body).toEqual({ name: 'Renamed skill' });
        });
    });

    it('refuses to save an empty skill name', async () => {
        const user = userEvent.setup();
        const bodies: unknown[] = [];

        stubList();
        stubFiles();
        server.use(respond('get', '/skills/skill-1', () => envelope(skill('skill-1', 'Weekly report'))));
        server.use(
            http.put(apiUrl('/skills/skill-1'), async ({ request }) => {
                bodies.push(await request.json());

                return envelope(skill('skill-1', 'Weekly report'));
            }),
        );

        renderModal();

        await user.click(await screen.findByRole('button', { name: /Weekly report/ }));
        await user.click(await screen.findByRole('button', { name: 'Skill actions' }));
        await user.click(await screen.findByRole('menuitem', { name: /Edit skill/ }));

        const nameInput = await screen.findByLabelText('Skill name');

        await user.clear(nameInput);
        await user.click(screen.getByRole('button', { name: /Save/ }));

        await waitFor(() => {
            expect(nameInput).toHaveValue('Weekly report');
        });

        // The rejected save leaves no trace of its own, so follow it with a save
        // that must reach the server: the recorded bodies have to be only that one.
        await user.clear(nameInput);
        await user.type(nameInput, 'Deliberate');
        await user.click(screen.getByRole('button', { name: /Save/ }));

        await waitFor(() => {
            expect(bodies).toEqual([{ name: 'Deliberate' }]);
        });
    });

    it('discards the draft when editing is cancelled', async () => {
        const user = userEvent.setup();

        stubList();
        stubFiles();
        server.use(respond('get', '/skills/skill-1', () => envelope(skill('skill-1', 'Weekly report'))));

        const { onClose } = renderModal();

        await user.click(await screen.findByRole('button', { name: /Weekly report/ }));
        await user.click(await screen.findByRole('button', { name: 'Skill actions' }));
        await user.click(await screen.findByRole('menuitem', { name: /Edit skill/ }));

        const nameInput = await screen.findByLabelText('Skill name');

        await user.clear(nameInput);
        await user.type(nameInput, 'Scratch');
        await user.click(screen.getByRole('button', { name: 'Cancel editing' }));

        expect(await screen.findByRole('heading', { name: 'Weekly report' })).toBeInTheDocument();
        expect(onClose).not.toHaveBeenCalled();
    });

    it('deletes an owned skill and returns to the empty pane', async () => {
        const user = userEvent.setup();
        let deleted = '';

        stubList();
        stubFiles();
        server.use(respond('get', '/skills/skill-1', () => envelope(skill('skill-1', 'Weekly report'))));
        server.use(
            http.delete(apiUrl('/skills/skill-1'), () => {
                deleted = 'skill-1';

                return envelope(null);
            }),
        );

        renderModal();

        await user.click(await screen.findByRole('button', { name: /Weekly report/ }));

        // The heading is the detail pane; the sidebar row with the same name is a button, not a heading.
        expect(await screen.findByRole('heading', { name: 'Weekly report' })).toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: 'Skill actions' }));
        await user.click(await screen.findByRole('menuitem', { name: /Delete skill/ }));

        const dialog = await screen.findByRole('alertdialog');

        await user.click(within(dialog).getByRole('button', { name: 'Delete' }));

        await waitFor(() => {
            expect(deleted).toBe('skill-1');
        });
        expect(await screen.findByRole('heading', { name: 'Write skill instructions' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Weekly report' })).not.toBeInTheDocument();
    });

    it('hides Edit and Delete for a skill owned by somebody else', async () => {
        const user = userEvent.setup();

        stubList([skill('skill-9', 'Shared skill', { creator: { _id: 'someone-else' } })]);
        stubFiles('skill-9');
        server.use(
            respond('get', '/skills/skill-9', () =>
                envelope(
                    skill('skill-9', 'Shared skill', {
                        creator: { _id: 'someone-else', name: { first: 'Other', last: 'Person' } },
                    }),
                ),
            ),
        );

        renderModal();

        await user.click(await screen.findByRole('button', { name: /Shared skill/ }));
        await user.click(await screen.findByRole('button', { name: 'Skill actions' }));

        expect(await screen.findByRole('menuitem', { name: /Download skill/ })).toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: /Edit skill/ })).not.toBeInTheDocument();
        expect(screen.queryByRole('menuitem', { name: /Delete skill/ })).not.toBeInTheDocument();
    });

    it('hands the typed description to the generate callback and closes', async () => {
        const user = userEvent.setup();

        stubList();
        const { onGenerateSkill, onClose } = renderModal();

        await user.click(await screen.findByRole('button', { name: /Generate skill/ }));

        const textarea = await screen.findByLabelText('Skill description');
        const submit = () => {
            const buttons = screen.getAllByRole('button', { name: 'Generate skill' });

            return buttons[buttons.length - 1];
        };

        expect(submit()).toBeDisabled();

        await user.type(textarea, '  Summarise research files  ');
        await user.click(submit());

        expect(onGenerateSkill).toHaveBeenCalledWith('Summarise research files');
        expect(onClose).toHaveBeenCalled();
    });

    it('creates a skill from the add panel and selects it', async () => {
        const user = userEvent.setup();
        let body: Record<string, unknown> = {};

        stubList();
        stubFiles('skill-new');
        server.use(respond('get', '/skills/skill-new', () => envelope(skill('skill-new', 'New skill'))));
        server.use(
            http.post(apiUrl('/skills'), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return envelope(skill('skill-new', 'New skill'));
            }),
        );

        const { onToggle } = renderModal();

        await user.click(await screen.findByRole('button', { name: /Add skill/ }));
        await user.type(await screen.findByLabelText(/Skill name/), '  weekly-status  ');
        await user.type(screen.getByLabelText('Description'), 'Weekly status');

        const instructions = document.querySelector('.ca-instr-editor');

        expect(instructions).not.toBeNull();

        await user.click(instructions as HTMLElement);
        await user.keyboard('Do the thing');
        await user.click(screen.getByRole('button', { name: 'Create skill' }));

        await waitFor(() => {
            expect(body.name).toBe('weekly-status');
        });
        expect(onToggle).toHaveBeenCalledWith({ _id: 'skill-new', name: 'New skill' });
    });

    it('blocks the create submit while the instructions are empty', async () => {
        const user = userEvent.setup();
        const bodies: unknown[] = [];

        stubList();
        stubFiles('skill-new');
        server.use(respond('get', '/skills/skill-new', () => envelope(skill('skill-new', 'New skill'))));
        server.use(
            http.post(apiUrl('/skills'), async ({ request }) => {
                bodies.push(await request.json());

                return envelope(skill('skill-new', 'New skill'));
            }),
        );

        renderModal();

        await user.click(await screen.findByRole('button', { name: /Add skill/ }));
        await user.type(await screen.findByLabelText(/Skill name/), 'weekly');
        await user.click(screen.getByRole('button', { name: 'Create skill' }));

        // Submitting with empty instructions surfaces the field error and turns
        // the button off — that is the positive signal the blocked click leaves.
        expect(await screen.findByText('Instructions are required')).toBeInTheDocument();
        expect(screen.getByRole('button', { name: 'Create skill' })).toBeDisabled();

        // Filling them re-enables it, and the POST that follows is what proves the
        // first click really sent nothing.
        const instructions = document.querySelector('.ca-instr-editor');

        await user.click(instructions as HTMLElement);
        await user.keyboard('Do the thing');
        await user.click(screen.getByRole('button', { name: 'Create skill' }));

        await waitFor(() => {
            expect(bodies).toHaveLength(1);
        });
    });

    // `add-skill` and `null` both render AddSkillPanel in the same position with no key, so that
    // transition is invisible to any DOM query. Back out of a detail pane instead, which is observable.
    it('returns from a skill detail pane to the instructions panel via Back', async () => {
        const user = userEvent.setup();

        stubList();
        stubFiles();
        server.use(respond('get', '/skills/skill-1', () => envelope(skill('skill-1', 'Weekly report'))));
        renderModal();

        await user.click(await screen.findByRole('button', { name: /Weekly report/ }));

        expect(await screen.findByRole('heading', { name: 'Weekly report' })).toBeInTheDocument();

        await user.click(await screen.findByRole('button', { name: 'Back' }));

        expect(await screen.findByRole('heading', { name: 'Write skill instructions' })).toBeInTheDocument();
        expect(screen.queryByRole('heading', { name: 'Weekly report' })).not.toBeInTheDocument();
    });

    it('dismisses the slash popup on Escape without closing the picker', async () => {
        const user = userEvent.setup();

        stubList();
        const { onClose } = renderStatefulModal();

        await screen.findByRole('heading', { name: 'Write skill instructions' });
        await openSlashPopup(user);

        await user.keyboard('{Escape}');

        await waitFor(() => {
            expect(document.querySelector('.ca-suggest__popover')).toBeNull();
        });
        expect(onClose).not.toHaveBeenCalled();
        expect(screen.getByRole('dialog')).toBeInTheDocument();
    });

    it('lets a second, deliberate Escape close the picker once the popup is gone', async () => {
        const user = userEvent.setup();

        stubList();
        const { onClose } = renderStatefulModal();

        await screen.findByRole('heading', { name: 'Write skill instructions' });
        await openSlashPopup(user);

        await user.keyboard('{Escape}');
        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    // Guard: the deferral must not swallow a plain Escape when nothing is mid-edit.
    it('lets Escape close the picker when no suggestion popup is open', async () => {
        const user = userEvent.setup();

        stubList();
        const { onClose } = renderStatefulModal();

        await screen.findByRole('heading', { name: 'Write skill instructions' });
        await user.keyboard('{Escape}');

        expect(onClose).toHaveBeenCalledTimes(1);
        expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    });

    it('closes from the empty pane header', async () => {
        const user = userEvent.setup();

        stubList();
        const { onClose } = renderModal();

        await user.click(await screen.findByRole('button', { name: 'Close' }));

        expect(onClose).toHaveBeenCalled();
    });
});
