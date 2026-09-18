import { http } from 'msw';
import { describe, expect, it } from 'vitest';

import { apiUrl, envelope, failureEnvelope, httpError, respond, server } from '@/test/msw';

import { agentPreferencesApi } from './agent-preferences';

describe('agentPreferencesApi.getPreferences', () => {
    it('returns the stored preferences object', async () => {
        server.use(respond('get', '/agents/agent-1/preferences', () => envelope({ defaultModelId: 'gpt-5' })));

        await expect(agentPreferencesApi.getPreferences('agent-1')).resolves.toEqual({ defaultModelId: 'gpt-5' });
    });

    it('keeps unknown keys so a key written by another client is not a parse failure', async () => {
        server.use(
            respond('get', '/agents/agent-1/preferences', () =>
                envelope({ defaultModelId: 'gpt-5', somethingElse: { nested: true } }),
            ),
        );

        await expect(agentPreferencesApi.getPreferences('agent-1')).resolves.toEqual({
            defaultModelId: 'gpt-5',
            somethingElse: { nested: true },
        });
    });

    it('returns null when the user never saved a preference', async () => {
        server.use(respond('get', '/agents/agent-1/preferences', () => envelope(null)));

        await expect(agentPreferencesApi.getPreferences('agent-1')).resolves.toBeNull();
    });

    it('returns null rather than throwing on a malformed body', async () => {
        server.use(respond('get', '/agents/agent-1/preferences', () => envelope({ defaultModelId: 42 })));

        await expect(agentPreferencesApi.getPreferences('agent-1')).resolves.toBeNull();
    });

    it('rejects when the envelope reports failure', async () => {
        server.use(respond('get', '/agents/agent-1/preferences', () => failureEnvelope('Preferences unavailable')));

        await expect(agentPreferencesApi.getPreferences('agent-1')).rejects.toThrow('Preferences unavailable');
    });

    it('rejects on a non-2xx response', async () => {
        server.use(respond('get', '/agents/agent-1/preferences', () => httpError(500, 'Boom')));

        await expect(agentPreferencesApi.getPreferences('agent-1')).rejects.toThrow();
    });
});

describe('agentPreferencesApi.patchPreferences', () => {
    it('sends only defaultModelId and returns the merged result', async () => {
        let patchBody: unknown;

        server.use(
            http.patch(apiUrl('/agents/agent-1/preferences'), async ({ request }) => {
                patchBody = await request.json();

                return envelope({ defaultModelId: '65f0a1b2c3d4e5f6a7b8c9d0', keptByServer: true });
            }),
        );

        const result = await agentPreferencesApi.patchPreferences('agent-1', {
            defaultModelId: '65f0a1b2c3d4e5f6a7b8c9d0',
        });

        expect(patchBody).toEqual({ defaultModelId: '65f0a1b2c3d4e5f6a7b8c9d0' });
        expect(result).toEqual({ defaultModelId: '65f0a1b2c3d4e5f6a7b8c9d0', keptByServer: true });
    });

    it('returns null rather than throwing on a malformed response', async () => {
        server.use(respond('patch', '/agents/agent-1/preferences', () => envelope('not-an-object')));

        await expect(agentPreferencesApi.patchPreferences('agent-1', { defaultModelId: 'gpt-5' })).resolves.toBeNull();
    });
});
