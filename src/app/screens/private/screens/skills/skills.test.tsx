import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { delay, http } from 'msw';
import { Navigate, Route, Routes } from 'react-router-dom';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, failureEnvelope, httpError, pagedEnvelope, rawPaged, respond, server } from '@/test/msw';
import { renderWithProviders } from '@/test/test-utils';
import type { SkillType } from '@/types/admin';

import SettingsLayout from '../connectors/settings-layout';

import Skills from './skills';

const ownedSkill = {
    _id: 'skill-owned',
    name: 'Brand voice',
    description: 'Rewrites copy in the house style',
    creator: { _id: 'user-1', name: { first: 'Test', last: 'User' } },
    updatedAt: '2026-03-04T12:00:00.000Z',
} as unknown as SkillType;

const sharedSkill = {
    _id: 'skill-shared',
    name: 'Legal review',
    description: 'Flags risky contract clauses',
    creator: { _id: 'user-2', name: { first: 'Other', last: 'Person' } },
    updatedAt: '2026-03-05T12:00:00.000Z',
} as unknown as SkillType;

const renderSettingsSkills = (route = '/settings/skills') =>
    renderWithProviders(
        <Routes>
            <Route path="/settings" element={<SettingsLayout />}>
                <Route index element={<Navigate to="/settings/skills" replace />} />
                <Route path="skills" element={<Skills />} />
                <Route path="skills/:skillId" element={<Skills />} />
            </Route>
        </Routes>,
        { route },
    );

/**
 * The sidebar fires two `GET /skills` calls: the paginated list and a dedicated
 * `createdByMe` query for the Personal group. One handler serves both, splitting
 * on the `createdByMe` param.
 */
const stubSkillsList = (personal: SkillType[], all: SkillType[]) => {
    server.use(
        http.get(apiUrl('/skills'), ({ request }) => {
            const isPersonal = new URL(request.url).searchParams.get('createdByMe') === 'true';

            return pagedEnvelope(isPersonal ? personal : all);
        }),
    );
};

const stubSkillDetail = (skill: SkillType, files: { path: string }[] = []) => {
    server.use(
        respond('get', `/skills/${skill._id}/files`, () => envelope(files)),
        respond('get', `/skills/${skill._id}`, () => envelope(skill)),
    );
};

describe('Skills settings list', () => {
    it('renders skills empty state in settings', async () => {
        stubSkillsList([], []);

        renderSettingsSkills();

        expect(screen.getByRole('link', { name: 'Skills' })).toBeInTheDocument();
        expect(screen.getByRole('heading', { name: 'Skills' })).toBeInTheDocument();

        await waitFor(() => {
            expect(screen.getByText('No skills found')).toBeInTheDocument();
        });

        expect(screen.getByText("You don't have any skills yet.")).toBeInTheDocument();
        expect(screen.getByText('Select a skill to get started')).toBeInTheDocument();
    });

    it('shows sidebar skeletons while the list is loading', () => {
        server.use(
            http.get(apiUrl('/skills'), async () => {
                await delay('infinite');

                return pagedEnvelope([]);
            }),
        );

        const { container } = renderSettingsSkills();

        expect(container.querySelector('.skills-sidebar-group-items')).toBeInTheDocument();
        expect(screen.queryByText('No skills found')).not.toBeInTheDocument();
    });

    it('splits skills into My and Firmwide groups', async () => {
        stubSkillsList([ownedSkill], [ownedSkill, sharedSkill]);

        renderSettingsSkills();

        await waitFor(() => {
            expect(screen.getByText('Legal review')).toBeInTheDocument();
        });

        const groups = document.querySelectorAll('.skills-sidebar-group');

        expect(groups).toHaveLength(2);
        expect(within(groups[0] as HTMLElement).getByText('Custom Skills')).toBeInTheDocument();
        expect(within(groups[0] as HTMLElement).getByText('Brand voice')).toBeInTheDocument();
        expect(within(groups[1] as HTMLElement).getByText('Firmwide Skills')).toBeInTheDocument();
        expect(within(groups[1] as HTMLElement).getByText('Legal review')).toBeInTheDocument();
    });

    it('tags each sidebar skill with its enablement state', async () => {
        const enabledSkill = { ...sharedSkill, globalEnabled: true } as SkillType;
        const disabledSkill = {
            ...sharedSkill,
            _id: 'skill-shared-off',
            name: 'Tone check',
            globalEnabled: false,
        } as SkillType;

        stubSkillsList([], [enabledSkill, disabledSkill]);

        renderSettingsSkills();

        await waitFor(() => {
            expect(screen.getByText('Tone check')).toBeInTheDocument();
        });

        const group = screen.getByText('Firmwide Skills').closest('.skills-sidebar-group') as HTMLElement;
        const enabledItem = within(group).getByText('Legal review').closest('li') as HTMLElement;
        const disabledItem = within(group).getByText('Tone check').closest('li') as HTMLElement;

        expect(within(enabledItem).getByText('Enabled')).toBeInTheDocument();
        expect(within(disabledItem).getByText('Disabled')).toBeInTheDocument();
    });

    it('honours an explicit preference over ownership when globalEnabled is absent', async () => {
        const optedOutOwnSkill = {
            ...ownedSkill,
            preference: { skillId: ownedSkill._id, userId: 'user-1', disabled: true },
        } as SkillType;

        stubSkillsList([optedOutOwnSkill], [optedOutOwnSkill]);

        renderSettingsSkills();

        await waitFor(() => {
            expect(screen.getByText('Brand voice')).toBeInTheDocument();
        });

        const group = screen.getByText('Custom Skills').closest('.skills-sidebar-group') as HTMLElement;
        const item = within(group).getByText('Brand voice').closest('li') as HTMLElement;

        expect(within(item).getByText('Disabled')).toBeInTheDocument();
        expect(within(item).queryByText('Enabled')).not.toBeInTheDocument();
    });

    it('renders an error state with Retry when the list request fails', async () => {
        server.use(respond('get', '/skills', () => httpError(500)));

        renderSettingsSkills();

        await waitFor(() => {
            expect(screen.getByText('Failed to load skills')).toBeInTheDocument();
        });

        expect(screen.getByRole('button', { name: 'Retry' })).toBeInTheDocument();
    });

    it('renders an error state when the API answers success: false', async () => {
        server.use(respond('get', '/skills', () => failureEnvelope('Skills service unavailable')));

        renderSettingsSkills();

        await waitFor(() => {
            expect(screen.getByText('Failed to load skills')).toBeInTheDocument();
        });
    });

    it('recovers when Retry is clicked after a failure', async () => {
        let failNext = true;

        server.use(
            http.get(apiUrl('/skills'), ({ request }) => {
                if (failNext) {
                    return httpError(500);
                }

                const isPersonal = new URL(request.url).searchParams.get('createdByMe') === 'true';

                return pagedEnvelope(isPersonal ? [] : [sharedSkill]);
            }),
        );

        renderSettingsSkills();

        await waitFor(() => {
            expect(screen.getByText('Failed to load skills')).toBeInTheDocument();
        });

        failNext = false;

        await userEvent.click(screen.getByRole('button', { name: 'Retry' }));

        await waitFor(() => {
            expect(screen.getByText('Legal review')).toBeInTheDocument();
        });
    });

    it('requests the paginated list and the personal list with the right params', async () => {
        const urls: string[] = [];

        server.use(
            http.get(apiUrl('/skills'), ({ request }) => {
                urls.push(request.url);

                return pagedEnvelope([]);
            }),
        );

        renderSettingsSkills();

        await waitFor(() => {
            expect(urls).toHaveLength(2);
        });

        const paged = urls
            .map((url) => new URL(url).searchParams)
            .find((params) => params.get('createdByMe') !== 'true');
        const personal = urls
            .map((url) => new URL(url).searchParams)
            .find((params) => params.get('createdByMe') === 'true');

        expect(paged?.get('page')).toBe('0');
        expect(paged?.get('size')).toBe('30');
        expect(personal?.get('size')).toBe('100');
    });

    it('sends the typed query as a search param and shows the no-match empty state', async () => {
        const searches: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/skills'), ({ request }) => {
                const params = new URL(request.url).searchParams;
                const search = params.get('search');

                searches.push(search);

                return pagedEnvelope(search ? [] : [ownedSkill]);
            }),
        );

        renderSettingsSkills();

        await waitFor(() => {
            expect(screen.getByText('Brand voice')).toBeInTheDocument();
        });

        await userEvent.type(screen.getByPlaceholderText('Search skills'), 'zzz');

        await waitFor(
            () => {
                expect(searches).toContain('zzz');
            },
            { timeout: 3000 },
        );

        await waitFor(() => {
            expect(screen.getByText('Nothing matches "zzz". Try a different search.')).toBeInTheDocument();
        });
    });

    it('fetches only the first page even when more pages exist', async () => {
        const pages: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/skills'), ({ request }) => {
                const params = new URL(request.url).searchParams;

                if (params.get('createdByMe') === 'true') {
                    return pagedEnvelope([]);
                }

                pages.push(params.get('page'));

                return envelope(rawPaged([sharedSkill], { page: 0, totalPages: 3, totalCount: 3 }));
            }),
        );

        renderSettingsSkills();

        await waitFor(() => {
            expect(screen.getByText('Legal review')).toBeInTheDocument();
        });

        expect(pages).toEqual(['0']);
    });
});

describe('Skills settings detail', () => {
    it('loads the selected skill and shows its details', async () => {
        stubSkillsList([ownedSkill], [ownedSkill]);
        stubSkillDetail(ownedSkill);

        renderSettingsSkills(`/settings/skills/${ownedSkill._id}`);

        await waitFor(() => {
            expect(screen.getByRole('heading', { name: 'Brand voice' })).toBeInTheDocument();
        });

        expect(screen.getByText('Description')).toBeInTheDocument();
        expect(screen.getByText('No file open')).toBeInTheDocument();
    });

    it('navigates to the skill detail route when a list item is clicked', async () => {
        stubSkillsList([ownedSkill], [ownedSkill]);

        const detailPaths: string[] = [];

        server.use(
            respond('get', `/skills/${ownedSkill._id}/files`, () => envelope([])),
            http.get(apiUrl('/skills/:id'), ({ request }) => {
                detailPaths.push(new URL(request.url).pathname);

                return envelope(ownedSkill);
            }),
        );

        renderSettingsSkills();

        await waitFor(() => {
            expect(screen.getByText('Brand voice')).toBeInTheDocument();
        });

        await userEvent.click(screen.getByText('Brand voice'));

        await waitFor(() => {
            expect(detailPaths).toContain('/skills/skill-owned');
        });

        expect(await screen.findByRole('heading', { name: 'Brand voice' })).toBeInTheDocument();
    });

    it('shows the not-found state when the detail request fails', async () => {
        stubSkillsList([], []);
        server.use(
            respond('get', `/skills/${sharedSkill._id}`, () => httpError(404)),
            respond('get', `/skills/${sharedSkill._id}/files`, () => envelope([])),
        );

        renderSettingsSkills(`/settings/skills/${sharedSkill._id}`);

        await waitFor(() => {
            expect(screen.getByText('Skill not found')).toBeInTheDocument();
        });

        expect(screen.getByText('This skill may have been deleted or you may not have access.')).toBeInTheDocument();
    });

    it('shows the not-found state when the detail endpoint answers success: false', async () => {
        stubSkillsList([], []);
        server.use(
            respond('get', `/skills/${sharedSkill._id}`, () => failureEnvelope('Skill not found')),
            respond('get', `/skills/${sharedSkill._id}/files`, () => envelope([])),
        );

        renderSettingsSkills(`/settings/skills/${sharedSkill._id}`);

        await waitFor(() => {
            expect(screen.getByText('Skill not found')).toBeInTheDocument();
        });
    });

    it('opts into a shared skill through the preferences endpoint', async () => {
        stubSkillsList([], [sharedSkill]);

        let putBody: unknown;
        let optedIn = false;

        server.use(
            respond('get', `/skills/${sharedSkill._id}/files`, () => envelope([])),
            http.get(apiUrl(`/skills/${sharedSkill._id}`), () =>
                envelope(
                    optedIn
                        ? { ...sharedSkill, preference: { skillId: sharedSkill._id, disabled: false } }
                        : sharedSkill,
                ),
            ),
            http.put(apiUrl(`/skills/${sharedSkill._id}/preferences`), async ({ request }) => {
                putBody = await request.json();
                optedIn = true;

                return envelope({ skillId: sharedSkill._id, userId: 'user-1', disabled: false });
            }),
        );

        renderSettingsSkills(`/settings/skills/${sharedSkill._id}`);

        await userEvent.click(await screen.findByRole('button', { name: 'Use skill' }));

        await waitFor(() => {
            expect(putBody).toEqual({ disabled: false });
        });

        expect(await screen.findByRole('button', { name: 'Disable' })).toBeInTheDocument();
    });

    it('refreshes the sidebar badge after the preference is toggled', async () => {
        let optedIn = false;

        server.use(
            http.get(apiUrl('/skills'), ({ request }) => {
                const isPersonal = new URL(request.url).searchParams.get('createdByMe') === 'true';

                return pagedEnvelope(isPersonal ? [] : [{ ...sharedSkill, globalEnabled: optedIn } as SkillType]);
            }),
            respond('get', `/skills/${sharedSkill._id}/files`, () => envelope([])),
            http.get(apiUrl(`/skills/${sharedSkill._id}`), () =>
                envelope(
                    optedIn
                        ? {
                              ...sharedSkill,
                              globalEnabled: true,
                              preference: { skillId: sharedSkill._id, disabled: false },
                          }
                        : { ...sharedSkill, globalEnabled: false },
                ),
            ),
            http.put(apiUrl(`/skills/${sharedSkill._id}/preferences`), () => {
                optedIn = true;

                return envelope({ skillId: sharedSkill._id, userId: 'user-1', disabled: false });
            }),
        );

        renderSettingsSkills(`/settings/skills/${sharedSkill._id}`);

        const findSidebarItem = () => {
            const group = screen.getByText('Firmwide Skills').closest('.skills-sidebar-group') as HTMLElement;

            return within(group).getByText('Legal review').closest('li') as HTMLElement;
        };

        await waitFor(() => {
            expect(within(findSidebarItem()).getByText('Disabled')).toBeInTheDocument();
        });

        await userEvent.click(await screen.findByRole('button', { name: 'Use skill' }));

        await waitFor(() => {
            expect(within(findSidebarItem()).getByText('Enabled')).toBeInTheDocument();
        });
    });

    it('disables an owned skill that is in use by default', async () => {
        stubSkillsList([ownedSkill], [ownedSkill]);

        let putBody: unknown;
        let disabled = false;

        server.use(
            respond('get', `/skills/${ownedSkill._id}/files`, () => envelope([])),
            http.get(apiUrl(`/skills/${ownedSkill._id}`), () =>
                envelope(
                    disabled ? { ...ownedSkill, preference: { skillId: ownedSkill._id, disabled: true } } : ownedSkill,
                ),
            ),
            http.put(apiUrl(`/skills/${ownedSkill._id}/preferences`), async ({ request }) => {
                putBody = await request.json();
                disabled = true;

                return envelope({ skillId: ownedSkill._id, userId: 'user-1', disabled: true });
            }),
        );

        renderSettingsSkills(`/settings/skills/${ownedSkill._id}`);

        await userEvent.click(await screen.findByRole('button', { name: 'Disable' }));

        await waitFor(() => {
            expect(putBody).toEqual({ disabled: true });
        });

        expect(await screen.findByRole('button', { name: 'Use skill' })).toBeInTheDocument();
    });

    it('requests the root file listing for the selected skill', async () => {
        stubSkillsList([ownedSkill], [ownedSkill]);

        let filesUrlRequested = '';

        server.use(
            respond('get', `/skills/${ownedSkill._id}`, () => envelope(ownedSkill)),
            http.get(apiUrl(`/skills/${ownedSkill._id}/files`), ({ request }) => {
                filesUrlRequested = request.url;

                return envelope([{ path: 'SKILL.md' }]);
            }),
        );

        renderSettingsSkills(`/settings/skills/${ownedSkill._id}`);

        await waitFor(() => {
            expect(filesUrlRequested).not.toBe('');
        });

        expect(new URL(filesUrlRequested).pathname).toBe('/skills/skill-owned/files');
    });
});
