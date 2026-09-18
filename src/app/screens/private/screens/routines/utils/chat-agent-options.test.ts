import { QueryClient } from '@tanstack/react-query';
import { describe, expect, it } from 'vitest';

import { envelope, pagedEnvelope, respond, server } from '@/test/msw';

import { loadChatAgentOptions } from './chat-agent-options';

const client = () => new QueryClient({ defaultOptions: { queries: { retry: false } } });

const agent = (id: string, name: string, type = 'chat') => ({ _id: id, name, type });

describe('loadChatAgentOptions', () => {
    it('drops every agent whose surface is not chat', async () => {
        server.use(
            respond('get', '/agents', () =>
                pagedEnvelope([
                    agent('chat-1', 'Research'),
                    agent('gallery-1', 'Amplify Image'),
                    agent('api-1', 'Feed', 'api'),
                ]),
            ),
            respond('get', '/agents/chat-1', () => envelope({ _id: 'chat-1', uiConfig: { componentType: 'chat' } })),
            respond('get', '/agents/gallery-1', () =>
                envelope({ _id: 'gallery-1', uiConfig: { componentType: 'gallery' } }),
            ),
        );

        // `api-1` never needs a record: the list's own `type` already rules it out.
        expect(await loadChatAgentOptions(client(), '')).toEqual([{ _id: 'chat-1', name: 'Research' }]);
    });

    it('leaves out an agent whose record cannot be read, since nothing proves it carries routines', async () => {
        server.use(
            respond('get', '/agents', () => pagedEnvelope([agent('chat-1', 'Research')])),
            respond('get', '/agents/chat-1', () => new Response('nope', { status: 500 })),
        );

        expect(await loadChatAgentOptions(client(), '')).toEqual([]);
    });

    it('leaves out an agent with no ui config saved at all', async () => {
        server.use(
            respond('get', '/agents', () => pagedEnvelope([agent('chat-1', 'Research')])),
            respond('get', '/agents/chat-1', () => envelope({ _id: 'chat-1' })),
        );

        expect(await loadChatAgentOptions(client(), '')).toEqual([]);
    });

    it('leaves out a chat agent that has routines turned off', async () => {
        server.use(
            respond('get', '/agents', () => pagedEnvelope([agent('chat-1', 'Research')])),
            respond('get', '/agents/chat-1', () =>
                envelope({ _id: 'chat-1', uiConfig: { componentType: 'chat', routines: { enabled: false } } }),
            ),
        );

        expect(await loadChatAgentOptions(client(), '')).toEqual([]);
    });
});
