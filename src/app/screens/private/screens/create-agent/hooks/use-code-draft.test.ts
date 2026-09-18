import { act, renderHook } from '@testing-library/react';
import { http } from 'msw';
import { describe, expect, it, vi } from 'vitest';

import { apiUrl, envelope, httpError, respond, server } from '@/test/msw';

import { useCodeDraft, type CodeDraftSeed, type UseCodeDraftOptions } from './use-code-draft';

interface Draft {
    text: string;
}

const code = (id: string, version: string) => ({
    _id: id,
    version,
    type: 'agent_ui_config',
    lang: 'json',
    code: '',
});

const baseOptions = (overrides: Partial<UseCodeDraftOptions<Draft>> = {}): UseCodeDraftOptions<Draft> => ({
    agentId: 'agent-1',
    codeType: 'agent_ui_config',
    lang: 'json',
    pointerField: 'uiConfigCodeId',
    label: 'Chat appearance',
    serialize: (value) => JSON.stringify(value),
    ...overrides,
});

const renderDraft = (seed: CodeDraftSeed<Draft>, overrides: Partial<UseCodeDraftOptions<Draft>> = {}) =>
    renderHook(() => useCodeDraft<Draft>(baseOptions(overrides), seed));

const published: Draft = { text: 'published' };

describe('useCodeDraft', () => {
    it('starts clean when there is no pending code', () => {
        const { result } = renderDraft({
            publishedCodeId: 'code-pub',
            publishedVersion: '1.0.0',
            publishedValue: published,
        });

        expect(result.current.hasPending).toBe(false);
        expect(result.current.isDirty()).toBe(false);
        expect(result.current.getCurrent()).toBe(published);
        expect(result.current.getPublished()).toBe(published);
    });

    it('starts pending and current when a draft was seeded', () => {
        const pending: Draft = { text: 'pending' };
        const { result } = renderDraft({
            publishedCodeId: 'code-pub',
            publishedValue: published,
            pendingCodeId: 'code-draft',
            pendingVersion: '1.0.1',
            pendingValue: pending,
        });

        expect(result.current.hasPending).toBe(true);
        expect(result.current.getCurrent()).toBe(pending);
        expect(result.current.isDirty()).toBe(true);
    });

    it('creates a bumped draft code the first time a published value is edited', async () => {
        let body: Record<string, unknown> = {};

        server.use(
            http.post(apiUrl('/codes'), async ({ request }) => {
                body = (await request.json()) as Record<string, unknown>;

                return envelope(code('code-draft', '1.0.1'));
            }),
        );

        const { result } = renderDraft({
            publishedCodeId: 'code-pub',
            publishedVersion: '1.0.0',
            publishedValue: published,
        });

        await act(async () => {
            await result.current.save({ text: 'edited' });
        });

        expect(body).toEqual({
            code: JSON.stringify({ text: 'edited' }),
            type: 'agent_ui_config',
            lang: 'json',
            version: '1.0.1',
            agentId: 'agent-1',
        });
        expect(result.current.hasPending).toBe(true);
        expect(result.current.getPublished()).toBe(published);
    });

    it('updates the existing draft on subsequent saves instead of creating another', async () => {
        let creates = 0;
        let updates = 0;

        server.use(
            http.post(apiUrl('/codes'), () => {
                creates += 1;

                return envelope(code('code-draft', '1.0.1'));
            }),
        );
        server.use(
            http.put(apiUrl('/codes/code-draft'), () => {
                updates += 1;

                return envelope(code('code-draft', '1.0.1'));
            }),
        );

        const { result } = renderDraft({
            publishedCodeId: 'code-pub',
            publishedVersion: '1.0.0',
            publishedValue: published,
        });

        await act(async () => {
            await result.current.save({ text: 'first' });
        });
        await act(async () => {
            await result.current.save({ text: 'second' });
        });

        expect(creates).toBe(1);
        expect(updates).toBe(1);
    });

    it('bootstraps a published code when allowed and nothing exists yet', async () => {
        let codeBody: Record<string, unknown> = {};
        let pointerBody: Record<string, unknown> = {};

        server.use(
            http.post(apiUrl('/codes'), async ({ request }) => {
                codeBody = (await request.json()) as Record<string, unknown>;

                return envelope(code('code-new', '1.0.0'));
            }),
        );
        server.use(
            http.put(apiUrl('/agents/agent-1'), async ({ request }) => {
                pointerBody = (await request.json()) as Record<string, unknown>;

                return envelope({ _id: 'agent-1' });
            }),
        );

        const { result } = renderDraft({}, { allowBootstrap: true });

        await act(async () => {
            await result.current.save({ text: 'first ever' });
        });

        expect(codeBody.version).toBe('1.0.0');
        expect(pointerBody).toEqual({ uiConfigCodeId: 'code-new' });
        expect(result.current.hasPending).toBe(false);
        expect(result.current.getPublished()).toEqual({ text: 'first ever' });
    });

    it('coalesces a save that lands mid-flight into a second round trip', async () => {
        let creates = 0;
        let updates = 0;
        const { result } = renderDraft({
            publishedCodeId: 'code-pub',
            publishedVersion: '1.0.0',
            publishedValue: published,
        });

        server.use(
            http.post(apiUrl('/codes'), () => {
                creates += 1;

                return envelope(code('code-draft', '1.0.1'));
            }),
        );
        server.use(
            http.put(apiUrl('/codes/code-draft'), () => {
                updates += 1;

                return envelope(code('code-draft', '1.0.1'));
            }),
        );

        await act(async () => {
            const first = result.current.save({ text: 'a' });
            const second = result.current.save({ text: 'b' });

            await Promise.all([first, second]);
        });

        expect(creates).toBe(1);
        expect(updates).toBe(1);
        expect(result.current.getCurrent()).toEqual({ text: 'b' });
    });

    it('reports save progress through the status callbacks', async () => {
        const status = { onSaving: vi.fn(), onSaved: vi.fn(), onError: vi.fn() };
        const onLocalSaved = vi.fn();

        server.use(respond('post', '/codes', () => envelope(code('code-draft', '1.0.1'))));

        const { result } = renderDraft(
            { publishedCodeId: 'code-pub', publishedVersion: '1.0.0', publishedValue: published },
            { status, onLocalSaved },
        );

        await act(async () => {
            await result.current.save({ text: 'edited' });
        });

        expect(status.onSaving).toHaveBeenCalled();
        expect(status.onSaved).toHaveBeenCalled();
        expect(status.onError).not.toHaveBeenCalled();
        expect(onLocalSaved).toHaveBeenCalledWith({ text: 'edited' });
    });

    it('reports a failed save through onError and resolves false', async () => {
        const status = { onSaving: vi.fn(), onSaved: vi.fn(), onError: vi.fn() };

        server.use(respond('post', '/codes', () => httpError(500)));

        const { result } = renderDraft(
            { publishedCodeId: 'code-pub', publishedVersion: '1.0.0', publishedValue: published },
            { status },
        );

        let saved: boolean | undefined;

        await act(async () => {
            saved = await result.current.save({ text: 'edited' });
        });

        expect(saved).toBe(false);
        expect(status.onSaved).not.toHaveBeenCalled();
        expect(status.onError).toHaveBeenCalledWith(expect.anything(), 'Chat appearance');
    });

    it('publish repoints the agent at the draft and clears the pending state', async () => {
        let pointerBody: Record<string, unknown> = {};

        server.use(
            http.put(apiUrl('/agents/agent-1'), async ({ request }) => {
                pointerBody = (await request.json()) as Record<string, unknown>;

                return envelope({ _id: 'agent-1' });
            }),
        );

        const pending: Draft = { text: 'pending' };
        const { result } = renderDraft({
            publishedCodeId: 'code-pub',
            publishedVersion: '1.0.0',
            publishedValue: published,
            pendingCodeId: 'code-draft',
            pendingVersion: '1.0.1',
            pendingValue: pending,
        });

        let ok: boolean | undefined;

        await act(async () => {
            ok = await result.current.publish();
        });

        expect(ok).toBe(true);
        expect(pointerBody).toEqual({ uiConfigCodeId: 'code-draft' });
        expect(result.current.hasPending).toBe(false);
        expect(result.current.getPublished()).toBe(pending);
    });

    it('publish is a no-op without a draft', async () => {
        let calls = 0;

        server.use(
            http.put(apiUrl('/agents/agent-1'), () => {
                calls += 1;

                return envelope({ _id: 'agent-1' });
            }),
        );

        const { result } = renderDraft({
            publishedCodeId: 'code-pub',
            publishedVersion: '1.0.0',
            publishedValue: published,
        });

        let ok: boolean | undefined;

        await act(async () => {
            ok = await result.current.publish();
        });

        expect(ok).toBe(false);
        expect(calls).toBe(0);
    });

    it('re-saves an edit that arrived while publishing was in flight', async () => {
        let creates = 0;

        server.use(respond('put', '/agents/agent-1', () => envelope({ _id: 'agent-1' })));
        server.use(
            http.post(apiUrl('/codes'), () => {
                creates += 1;

                return envelope(code('code-draft-2', '1.0.2'));
            }),
        );

        const { result } = renderDraft({
            publishedCodeId: 'code-pub',
            publishedVersion: '1.0.0',
            publishedValue: published,
            pendingCodeId: 'code-draft',
            pendingVersion: '1.0.1',
            pendingValue: { text: 'pending' },
        });

        await act(async () => {
            const publishing = result.current.publish();

            result.current.resetCurrent({ text: 'typed while publishing' });
            await publishing;
        });

        expect(creates).toBe(1);
    });

    it('discard deletes the draft code and rolls back to the published value', async () => {
        let deleted = '';

        server.use(
            http.delete(apiUrl('/codes/code-draft'), () => {
                deleted = 'code-draft';

                return envelope(null);
            }),
        );

        const { result } = renderDraft({
            publishedCodeId: 'code-pub',
            publishedVersion: '1.0.0',
            publishedValue: published,
            pendingCodeId: 'code-draft',
            pendingVersion: '1.0.1',
            pendingValue: { text: 'pending' },
        });

        let rolledBack: Draft | undefined;

        await act(async () => {
            rolledBack = await result.current.discard();
        });

        expect(deleted).toBe('code-draft');
        expect(rolledBack).toBe(published);
        expect(result.current.hasPending).toBe(false);
        expect(result.current.getCurrent()).toBe(published);
    });

    it('discard still rolls back locally when the delete fails', async () => {
        server.use(respond('delete', '/codes/code-draft', () => httpError(500)));

        const { result } = renderDraft({
            publishedCodeId: 'code-pub',
            publishedValue: published,
            pendingCodeId: 'code-draft',
            pendingValue: { text: 'pending' },
        });

        await act(async () => {
            await result.current.discard();
        });

        expect(result.current.getCurrent()).toBe(published);
        expect(result.current.hasPending).toBe(false);
    });

    it('reseed replaces every pointer and value', () => {
        const { result } = renderDraft({
            publishedCodeId: 'code-pub',
            publishedValue: published,
        });

        const next: Draft = { text: 'reseeded' };

        act(() => {
            result.current.reseed({
                publishedCodeId: 'code-other',
                publishedVersion: '2.0.0',
                publishedValue: next,
                pendingCodeId: 'code-other-draft',
                pendingVersion: '2.0.1',
                pendingValue: { text: 'reseeded draft' },
            });
        });

        expect(result.current.hasPending).toBe(true);
        expect(result.current.getPublished()).toBe(next);
        expect(result.current.getCurrent()).toEqual({ text: 'reseeded draft' });
    });

    it('reseed falls back to the published value when there is no draft', () => {
        const { result } = renderDraft({ publishedCodeId: 'code-pub', publishedValue: published });
        const next: Draft = { text: 'only published' };

        act(() => {
            result.current.reseed({ publishedCodeId: 'code-other', publishedValue: next });
        });

        expect(result.current.hasPending).toBe(false);
        expect(result.current.getCurrent()).toBe(next);
    });
});
