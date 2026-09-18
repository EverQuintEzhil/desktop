import { act, screen, waitFor } from '@testing-library/react';
import { http } from 'msw';
import { useSearchParams } from 'react-router-dom';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, httpError, rawPaged, respond, server } from '@/test/msw';
import { renderHookWithProviders, renderWithProviders } from '@/test/test-utils';
import type { JobType } from '@/types/admin';
import type { GeneratedItem } from '@/types/gallery';

import { useGalleryMediaState, type UseGalleryMediaStateOptions } from './use-gallery-media-state';

const OPTIONS: UseGalleryMediaStateOptions = {
    agentId: 'agent-1',
    agentSlug: 'gallery-agent',
    userId: 'user-1',
    userName: 'Test User',
    placeholderExtension: 'png',
    isVideo: false,
};

const apiFile = (id: string, overrides: Record<string, unknown> = {}) => ({
    _id: id,
    name: `${id}.png`,
    type: 'image/png',
    url: `https://files.localhost/${id}.png`,
    creator_id: 'user-1',
    likes: [] as string[],
    likes_count: 0,
    ...overrides,
});

const stubJobs = (values: unknown[] = []) => {
    server.use(respond('get', '/jobs', () => envelope(rawPaged(values))));
};

const stubFiles = (values: unknown[] = [apiFile('f1')]) => {
    server.use(respond('get', '/files', () => envelope(rawPaged(values, { page: 0, totalPages: 1 }))));
};

const renderGallery = (options: Partial<UseGalleryMediaStateOptions> = {}, route = '/agent/gallery-agent') =>
    renderHookWithProviders(() => useGalleryMediaState({ ...OPTIONS, ...options }), { route });

describe('useGalleryMediaState', () => {
    beforeEach(() => {
        stubJobs();
        vi.spyOn(console, 'error').mockImplementation(() => {});
    });

    afterEach(() => {
        vi.restoreAllMocks();
    });

    it('maps the server files into gallery items', async () => {
        stubFiles([apiFile('f1'), apiFile('f2', { creator_id: 'someone-else', likes: ['user-1'] })]);

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(2);
        });

        const [first, second] = result.current.state.history;

        expect(first.uniqueId).toBe('file-f1');
        expect(first.isMyItem).toBe(true);
        expect(first.isLikedByThisUser).toBe(false);
        expect(second.isMyItem).toBe(false);
        expect(second.isLikedByThisUser).toBe(true);
    });

    it('reports an empty gallery', async () => {
        stubFiles([]);

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.loading).toBe(false);
        });
        expect(result.current.state.history).toEqual([]);
    });

    it('surfaces a fetch error and recovers on retry', async () => {
        let fail = true;

        server.use(
            http.get(apiUrl('/files'), () => {
                if (fail) {
                    return httpError(500);
                }

                return envelope(rawPaged([apiFile('f1')], { page: 0, totalPages: 1 }));
            }),
        );

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.error).toBeTruthy();
        });

        fail = false;
        await act(async () => {
            await result.current.retryFetch();
        });

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(1);
        });
    });

    it("asks for the caller's own files on the default tab", async () => {
        let url = '';

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                url = request.url;

                return envelope(rawPaged([apiFile('f1')], { page: 0, totalPages: 1 }));
            }),
        );

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(1);
        });

        const params = new URL(url).searchParams;

        expect(result.current.activeTab).toBe('my');
        expect(params.get('agentId')).toBe('agent-1');
        expect(params.get('mineOnly')).toBe('true');
        expect(params.get('aiGenerated')).toBe('true');
        expect(params.get('size')).toBe('20');
        expect(params.has('liked')).toBe(false);
    });

    it('reads the active tab out of the query string and asks for likes', async () => {
        let url = '';

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                url = request.url;

                return envelope(rawPaged([apiFile('f1')], { page: 0, totalPages: 1 }));
            }),
        );

        const { result } = renderGallery({}, '/agent/gallery-agent?tab=fav');

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(1);
        });

        expect(result.current.activeTab).toBe('fav');
        expect(new URL(url).searchParams.get('liked')).toBe('true');
    });

    it('drops mineOnly when the firmwide tab is active', async () => {
        let url = '';

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                url = request.url;

                return envelope(rawPaged([apiFile('f1')], { page: 0, totalPages: 1 }));
            }),
        );

        renderGallery({}, '/agent/gallery-agent?tab=firmwide');

        await waitFor(() => {
            expect(url).toContain('/files');
        });
        expect(new URL(url).searchParams.get('mineOnly')).toBe('false');
    });

    it('writes the chosen tab back into the query string', async () => {
        stubFiles();

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(1);
        });

        act(() => {
            result.current.setActiveTab('firmwide');
        });

        await waitFor(() => {
            expect(result.current.activeTab).toBe('firmwide');
        });
    });

    it('ignores a tab change when the tab is fixed by the caller', async () => {
        stubFiles();

        const { result } = renderGallery({ fixedTab: 'firmwide' });

        await waitFor(() => {
            expect(result.current.activeTab).toBe('firmwide');
        });

        act(() => {
            result.current.setActiveTab('my');
        });

        expect(result.current.activeTab).toBe('firmwide');
    });

    it('sends the trimmed search term', async () => {
        const searches: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                searches.push(new URL(request.url).searchParams.get('search'));

                return envelope(rawPaged([apiFile('f1')], { page: 0, totalPages: 1 }));
            }),
        );

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(1);
        });

        act(() => {
            result.current.setSearchQuery('  sunset  ');
        });

        await waitFor(() => {
            expect(searches).toContain('sunset');
        });
    });

    it('loads the next page when there is one', async () => {
        const pages: (string | null)[] = [];

        server.use(
            http.get(apiUrl('/files'), ({ request }) => {
                const page = new URL(request.url).searchParams.get('page');

                pages.push(page);

                return envelope(rawPaged([apiFile(`f-${page}`)], { page: Number(page), totalPages: 3 }));
            }),
        );

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(1);
        });

        act(() => {
            result.current.loadMore();
        });

        await waitFor(() => {
            expect(pages).toContain('1');
        });
        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(2);
        });
    });

    it('removes an item from the cached pages', async () => {
        stubFiles([apiFile('f1'), apiFile('f2')]);

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(2);
        });

        act(() => {
            result.current.removeItem('f1');
        });

        await waitFor(() => {
            expect(result.current.state.history.map((item) => item._id)).toEqual(['f2']);
        });
    });

    it('patches a single item in place', async () => {
        stubFiles([apiFile('f1', { title: 'old title' })]);

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(1);
        });

        act(() => {
            result.current.onItemChange({ ...result.current.state.history[0], title: 'new title' } as GeneratedItem);
        });

        await waitFor(() => {
            expect(result.current.state.history[0].title).toBe('new title');
        });
    });

    it('ignores a patch with no id', async () => {
        stubFiles();

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(1);
        });

        act(() => {
            result.current.onItemChange({} as GeneratedItem);
        });

        expect(result.current.state.history).toHaveLength(1);
    });

    it('records a like against the current user', async () => {
        stubFiles([apiFile('f1')]);

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(1);
        });

        act(() => {
            result.current.onLikeItemClicked({
                ...result.current.state.history[0],
                isLikedByThisUser: true,
                likes_count: 1,
            } as GeneratedItem);
        });

        await waitFor(() => {
            expect(result.current.state.history[0].isLikedByThisUser).toBe(true);
        });
        expect(result.current.state.history[0].likes).toEqual(['user-1']);
    });

    it('deletes an item after the confirmation is accepted', async () => {
        let deleted = '';

        stubFiles([apiFile('f1'), apiFile('f2')]);
        server.use(
            http.delete(apiUrl('/files/f1'), () => {
                deleted = 'f1';

                return envelope(null);
            }),
        );

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(2);
        });

        act(() => {
            result.current.onDeleteItemClicked(result.current.state.history[0]);
        });

        expect(result.current.isConfirmationModalOpen?._id).toBe('f1');

        await act(async () => {
            await result.current.onConfirmClick();
        });

        expect(deleted).toBe('f1');
        expect(result.current.isConfirmationModalOpen).toBeNull();
        await waitFor(() => {
            expect(result.current.state.history.map((item) => item._id)).toEqual(['f2']);
        });
    });

    it('keeps the item when the delete request fails', async () => {
        stubFiles([apiFile('f1')]);
        server.use(respond('delete', '/files/f1', () => httpError(500)));

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(1);
        });

        act(() => {
            result.current.onDeleteItemClicked(result.current.state.history[0]);
        });
        await act(async () => {
            await result.current.onConfirmClick();
        });

        expect(result.current.isConfirmationModalOpen?._id).toBe('f1');
        expect(result.current.state.history).toHaveLength(1);
    });

    it('closes the confirmation without deleting', async () => {
        stubFiles();

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(1);
        });

        act(() => {
            result.current.onDeleteItemClicked(result.current.state.history[0]);
        });
        act(() => {
            result.current.closeConfirmModal();
        });

        expect(result.current.isConfirmationModalOpen).toBeNull();
    });

    it('opens the lightbox on the already-loaded file behind a finished job', async () => {
        stubFiles([apiFile('f1')]);

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(1);
        });

        act(() => {
            result.current.handleNotificationJobClick({
                _id: 'job-1',
                status: 'completed',
                output: [{ identifier: 'f1' }],
            } as unknown as JobType);
        });

        expect(result.current.lightboxImage?._id).toBe('f1');
        expect(result.current.lightboxJob).toBeNull();
    });

    it('falls back to the job itself when its file is not in the list', async () => {
        stubFiles([apiFile('f1')]);

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(1);
        });

        const job = { _id: 'job-2', status: 'running' } as unknown as JobType;

        act(() => {
            result.current.handleNotificationJobClick(job);
        });

        expect(result.current.lightboxJob).toBe(job);
        expect(result.current.lightboxImage).toBeNull();
    });

    it('resolves the file behind a job whose output is a bare object', async () => {
        stubFiles([apiFile('f1')]);

        const { result } = renderGallery();

        await waitFor(() => {
            expect(result.current.state.history).toHaveLength(1);
        });

        act(() => {
            result.current.handleNotificationJobClick({
                _id: 'job-3',
                status: 'completed',
                output: { identifier: 'f1' },
            } as unknown as JobType);
        });

        expect(result.current.lightboxImage?._id).toBe('f1');
    });

    describe('running-job placeholders', () => {
        const runningJob = (overrides: Record<string, unknown> = {}) => ({
            _id: 'job-1',
            status: 'running',
            message: 'a cat riding a bike',
            createdAt: '2025-01-01T00:00:00.000Z',
            updatedAt: '2025-01-01T00:00:05.000Z',
            modelId: 'model-1',
            ...overrides,
        });

        it('prepends a placeholder for every pending job on the my tab', async () => {
            stubJobs([runningJob()]);
            stubFiles([apiFile('f1')]);

            const { result } = renderGallery();

            await waitFor(() => {
                expect(result.current.state.history).toHaveLength(2);
            });

            const [placeholder, real] = result.current.state.history;

            expect(placeholder._id).toBe('job-1');
            expect(placeholder.uniqueId).toBe('job-1');
            expect(placeholder.isRunning).toBe(true);
            expect(placeholder.isMyItem).toBe(true);
            expect(placeholder.title).toBe('a cat riding a bike');
            expect(placeholder.creator_name).toBe('Test User');
            expect(placeholder.created_at).toBe(1735689600000);
            expect(placeholder.extension).toBe('png');
            expect(placeholder.ai.model_id).toBe('model-1');
            expect(placeholder.ai.model_name).toBe('');
            expect(real._id).toBe('f1');
        });

        it('reads the model triple out of a populated modelId', async () => {
            stubJobs([runningJob({ modelId: { _id: 'model-9', model: 'imagen-3', provider: 'google' } })]);
            stubFiles([]);

            const { result } = renderGallery();

            await waitFor(() => {
                expect(result.current.state.history).toHaveLength(1);
            });

            expect(result.current.state.history[0].ai).toMatchObject({
                model_id: 'model-9',
                model_name: 'imagen-3',
                model_provider: 'google',
            });
        });

        it('leaves a finished job out of the overlay', async () => {
            stubJobs([runningJob({ _id: 'job-done', status: 'completed', output: [{ identifier: 'f1' }] })]);
            stubFiles([apiFile('f1')]);

            const { result } = renderGallery();

            await waitFor(() => {
                expect(result.current.state.history).toHaveLength(1);
            });
            expect(result.current.state.history[0]._id).toBe('f1');
        });

        it('shows no placeholders on the firmwide tab', async () => {
            stubJobs([runningJob()]);
            stubFiles([apiFile('f1')]);

            const { result } = renderGallery({}, '/agent/gallery-agent?tab=firmwide');

            await waitFor(() => {
                expect(result.current.state.history).toHaveLength(1);
            });
            expect(result.current.state.history[0]._id).toBe('f1');
        });
    });

    describe('lightbox deep link', () => {
        const recordFileFetches = (build: (id: string) => Response) => {
            const fetched: string[] = [];

            server.use(
                http.get(apiUrl('/files/:fileId'), ({ params }) => {
                    const fileId = String(params.fileId);

                    fetched.push(fileId);

                    return build(fileId);
                }),
            );

            return fetched;
        };

        it('fetches an unloaded file, opens it and drops the parameter', async () => {
            stubFiles([apiFile('f1')]);
            const fetched = recordFileFetches((id) => envelope(apiFile(id, { title: 'Deep linked' })));

            const { result } = renderGallery({}, '/agent/gallery-agent?lightboxFileId=f9');

            await waitFor(() => {
                expect(result.current.lightboxImage?._id).toBe('f9');
            });
            expect(fetched).toEqual(['f9']);
            expect(result.current.lightboxImage?.uniqueId).toBe('file-f9');
        });

        it('uses an item that is already in the list instead of refetching', async () => {
            stubFiles([apiFile('f1')]);
            const fetched = recordFileFetches((id) => envelope(apiFile(id)));

            let hook: ReturnType<typeof useGalleryMediaState> | undefined;

            const Probe = () => {
                const [, setSearchParams] = useSearchParams();

                hook = useGalleryMediaState(OPTIONS);

                return (
                    <button type="button" onClick={() => setSearchParams({ lightboxFileId: 'f1' })}>
                        deep link
                    </button>
                );
            };

            renderWithProviders(<Probe />, { route: '/agent/gallery-agent' });

            await waitFor(() => {
                expect(hook?.state.history).toHaveLength(1);
            });

            act(() => {
                screen.getByRole('button', { name: 'deep link' }).click();
            });

            await waitFor(() => {
                expect(hook?.lightboxImage?._id).toBe('f1');
            });
            expect(fetched).toEqual([]);

            // Deliberate fetch against the same recorder so the empty list above is load-bearing.
            renderGallery({}, '/agent/gallery-agent?lightboxFileId=f9');

            await waitFor(() => {
                expect(fetched).toEqual(['f9']);
            });
        });

        it('leaves the lightbox closed for a deleted file', async () => {
            stubFiles([apiFile('f1')]);
            const fetched = recordFileFetches(() => envelope(apiFile('f9', { is_deleted: true })));

            const { result } = renderGallery({}, '/agent/gallery-agent?lightboxFileId=f9');

            await waitFor(() => {
                expect(fetched).toEqual(['f9']);
            });
            expect(result.current.lightboxImage).toBeNull();
        });

        it('leaves the lightbox closed when the fetch fails', async () => {
            stubFiles([apiFile('f1')]);
            const fetched = recordFileFetches(() => httpError(500));

            const { result } = renderGallery({}, '/agent/gallery-agent?lightboxFileId=f9');

            await waitFor(() => {
                expect(fetched).toEqual(['f9']);
            });
            expect(result.current.lightboxImage).toBeNull();
        });
    });

    describe('rendered helpers', () => {
        it('renders the confirmation modal only once an item is queued for deletion', async () => {
            stubFiles([apiFile('f1')]);

            let hook: ReturnType<typeof useGalleryMediaState> | undefined;

            const Probe = () => {
                hook = useGalleryMediaState(OPTIONS);

                return <div>{hook.renderConfirmationModal('Delete this image?')}</div>;
            };

            renderWithProviders(<Probe />, { route: '/agent/gallery-agent' });

            await waitFor(() => {
                expect(hook?.state.history).toHaveLength(1);
            });

            expect(screen.queryByText('Delete this image?')).not.toBeInTheDocument();

            act(() => {
                hook?.onDeleteItemClicked(hook.state.history[0]);
            });

            expect(await screen.findByText('Delete this image?')).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
            expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
        });

        it('renders no lightbox while nothing is selected', async () => {
            stubFiles([apiFile('f1')]);

            const { result } = renderGallery();

            await waitFor(() => {
                expect(result.current.state.history).toHaveLength(1);
            });

            const viewProps = {
                agent: null,
                query: '',
                setQuery: () => {},
                plusOptions: {},
                isVideo: false,
                downloadNamePrefix: 'gallery',
            } as unknown as Parameters<typeof result.current.renderLightbox>[0];

            expect(result.current.renderLightbox(viewProps)).toBeNull();
            expect(result.current.renderLightboxFileId(viewProps)).toBeNull();
        });
    });
});
