import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, server } from '@/test/msw';

import { appArtifactApi } from './artifact';

const ARTIFACT_ID = 'conv-1:plan';
const ENCODED_PATH = `/ai/artifacts/${encodeURIComponent(ARTIFACT_ID)}`;

const headDocument = {
    agent_id: 'agent-1',
    conversation_id: 'conv-1',
    slug: 'plan',
    title: 'Launch plan',
    artifact_type: 'code',
    language: 'python',
    latest_version: 2,
    creator_id: 'user-1',
    last_author_kind: 'user',
    is_deleted: false,
    created_at: '2026-09-09T10:00:00.000Z',
    updated_at: '2026-09-09T12:00:00.000Z',
};

const versionDocument = {
    artifact_id: ARTIFACT_ID,
    version_number: 2,
    title: 'Launch plan',
    artifact_type: 'code',
    language: 'python',
    content_bytes: 9,
    author_kind: 'user',
    author_id: 'user-1',
    author_name: 'Fizan',
    restored_from_version: null,
    created_at: '2026-09-09T12:00:00.000Z',
    content: 'print(1)',
};

describe('appArtifactApi', () => {
    it('maps a head document to camelCase and derives the artifact id from conversation and slug', async () => {
        server.use(http.get(apiUrl(ENCODED_PATH), () => envelope(headDocument)));

        await expect(appArtifactApi.getArtifact(ARTIFACT_ID, 'agent-1')).resolves.toEqual({
            artifactId: ARTIFACT_ID,
            agentId: 'agent-1',
            conversationId: 'conv-1',
            slug: 'plan',
            title: 'Launch plan',
            artifactType: 'code',
            language: 'python',
            latestVersion: 2,
            creatorId: 'user-1',
            lastAuthorKind: 'user',
            createdAt: '2026-09-09T10:00:00.000Z',
            updatedAt: '2026-09-09T12:00:00.000Z',
        });
    });

    it('parses the document the ai service really returns, extra server-only fields and all', async () => {
        const liveHead = {
            artifact_id: 'rest-conv-1:rest-plan',
            agent_id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
            conversation_id: 'rest-conv-1',
            slug: 'rest-plan',
            creator_id: 'user-rest-owner',
            editor_user_ids: [],
            is_deleted: false,
            is_incognito: false,
            created_at: '2026-09-09T15:52:16.225Z',
            title: 'REST plan',
            artifact_type: 'markdown',
            language: null,
            latest_version: 1,
            last_author_kind: 'model',
            updated_at: '2026-09-09T15:52:16.225Z',
        };
        const liveVersion = {
            artifact_id: 'rest-conv-1:rest-plan',
            agent_id: 'bbbbbbbbbbbbbbbbbbbbbbbb',
            conversation_id: 'rest-conv-1',
            version_number: 1,
            title: 'REST plan',
            artifact_type: 'markdown',
            language: null,
            content: '# version one',
            content_bytes: 13,
            author_kind: 'model',
            author_id: 'user-rest-owner',
            author_name: null,
            model_id: 'model-rest',
            restored_from_version: null,
            message_id: null,
            created_at: '2026-09-09T15:52:16.225Z',
        };
        const livePath = `/ai/artifacts/${encodeURIComponent('rest-conv-1:rest-plan')}`;

        server.use(
            http.get(apiUrl(livePath), () => envelope(liveHead)),
            http.get(apiUrl(`${livePath}/versions/1`), () => envelope(liveVersion)),
        );

        const head = await appArtifactApi.getArtifact('rest-conv-1:rest-plan', 'bbbbbbbbbbbbbbbbbbbbbbbb');
        const version = await appArtifactApi.getVersion('rest-conv-1:rest-plan', 'bbbbbbbbbbbbbbbbbbbbbbbb', 1);

        expect(head).toEqual({
            artifactId: 'rest-conv-1:rest-plan',
            agentId: 'bbbbbbbbbbbbbbbbbbbbbbbb',
            conversationId: 'rest-conv-1',
            slug: 'rest-plan',
            title: 'REST plan',
            artifactType: 'markdown',
            language: undefined,
            latestVersion: 1,
            creatorId: 'user-rest-owner',
            lastAuthorKind: 'model',
            createdAt: '2026-09-09T15:52:16.225Z',
            updatedAt: '2026-09-09T15:52:16.225Z',
        });
        expect(version).toEqual({
            artifactId: 'rest-conv-1:rest-plan',
            versionNumber: 1,
            title: 'REST plan',
            artifactType: 'markdown',
            language: undefined,
            content: '# version one',
            contentBytes: 13,
            authorKind: 'model',
            authorId: 'user-rest-owner',
            authorName: undefined,
            restoredFromVersion: undefined,
            createdAt: '2026-09-09T15:52:16.225Z',
        });
    });

    it('sends the agent id on every read', async () => {
        const seen: string[] = [];

        server.use(
            http.get(apiUrl(`${ENCODED_PATH}/versions`), ({ request }) => {
                seen.push(new URL(request.url).searchParams.get('agentId') ?? '');

                return envelope([versionDocument]);
            }),
        );

        const versions = await appArtifactApi.listVersions(ARTIFACT_ID, 'agent-1');

        expect(seen).toEqual(['agent-1']);
        expect(versions).toHaveLength(1);
        expect(versions[0]).toMatchObject({
            versionNumber: 2,
            contentBytes: 9,
            authorKind: 'user',
            authorName: 'Fizan',
        });
        expect(versions[0]).not.toHaveProperty('content');
    });

    it('turns a null restored_from_version into an absent field rather than null', async () => {
        server.use(http.get(apiUrl(`${ENCODED_PATH}/versions/2`), () => envelope(versionDocument)));

        const version = await appArtifactApi.getVersion(ARTIFACT_ID, 'agent-1', 2);

        expect(version.content).toBe('print(1)');
        expect(version.restoredFromVersion).toBeUndefined();
    });

    it('forwards the conversation filter and paging to the list endpoint', async () => {
        let query = '';

        server.use(
            http.get(apiUrl('/ai/artifacts'), ({ request }) => {
                query = new URL(request.url).search;

                return envelope({ total: 0, items: [] });
            }),
        );

        await appArtifactApi.listArtifacts({ agentId: 'agent-1', conversationId: 'conv-1', from: 10, size: 25 });

        expect(query).toContain('agentId=agent-1');
        expect(query).toContain('conversationId=conv-1');
        expect(query).toContain('from=10');
        expect(query).toContain('size=25');
    });

    it('rejects a save that would exceed the 128 KB store limit before any request is made', async () => {
        await expect(
            appArtifactApi.saveVersion(ARTIFACT_ID, 'agent-1', { content: 'a'.repeat(131073) }),
        ).rejects.toThrow(/128 KB/);
    });

    it('rejects a save with no content', async () => {
        await expect(appArtifactApi.saveVersion(ARTIFACT_ID, 'agent-1', { content: '' })).rejects.toThrow(
            /empty content/,
        );
    });

    it('rejects a read with no agent id, since every artifact query must be scoped to one agent', async () => {
        await expect(appArtifactApi.getArtifact(ARTIFACT_ID, '  ')).rejects.toThrow(/agent id is required/i);
    });
});
