import { describe, expect, it } from 'vitest';

import { httpError, pagedEnvelope, respond, server } from '@/test/msw';

import { appAboutApi, BUILDER_AGENT_MODELS_ABOUT_KEY, parseBuilderAgentModels } from './about';

describe('parseBuilderAgentModels', () => {
    it('returns the model list when the About value matches the schema', () => {
        expect(
            parseBuilderAgentModels([
                { modelId: 'm-1', modelName: 'gpt-5.5' },
                { modelId: 'm-2', modelName: 'claude-sonnet-4-6' },
            ]),
        ).toEqual([
            { modelId: 'm-1', modelName: 'gpt-5.5' },
            { modelId: 'm-2', modelName: 'claude-sonnet-4-6' },
        ]);
    });

    it('keeps valid models when some entries are malformed', () => {
        expect(parseBuilderAgentModels([{ modelId: 'm-1', modelName: 'gpt-5.5' }, { modelId: 'm-2' }, null])).toEqual([
            { modelId: 'm-1', modelName: 'gpt-5.5' },
        ]);
    });

    it('returns an empty list for non-array About values', () => {
        expect(parseBuilderAgentModels(null)).toEqual([]);
        expect(parseBuilderAgentModels('gpt-5.5')).toEqual([]);
    });
});

describe('appAboutApi.getByKey', () => {
    it('returns the About row whose key matches exactly', async () => {
        server.use(
            respond('get', '/abouts', () =>
                pagedEnvelope([
                    { key: 'other-key', value: [] },
                    {
                        key: BUILDER_AGENT_MODELS_ABOUT_KEY,
                        value: [{ modelId: 'm-1', modelName: 'gpt-5.5' }],
                    },
                ]),
            ),
        );

        await expect(appAboutApi.getByKey(BUILDER_AGENT_MODELS_ABOUT_KEY)).resolves.toEqual({
            key: BUILDER_AGENT_MODELS_ABOUT_KEY,
            value: [{ modelId: 'm-1', modelName: 'gpt-5.5' }],
        });
    });

    it('returns undefined when the key is absent', async () => {
        server.use(respond('get', '/abouts', () => pagedEnvelope([{ key: 'other-key', value: [] }])));

        await expect(appAboutApi.getByKey(BUILDER_AGENT_MODELS_ABOUT_KEY)).resolves.toBeUndefined();
    });

    it('surfaces API failures', async () => {
        server.use(respond('get', '/abouts', () => httpError(403)));

        await expect(appAboutApi.getByKey(BUILDER_AGENT_MODELS_ABOUT_KEY)).rejects.toThrow();
    });
});
