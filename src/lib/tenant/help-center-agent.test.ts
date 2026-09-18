import { describe, expect, it } from 'vitest';

import { parseHelpCenterAgent } from './help-center-agent';

describe('parseHelpCenterAgent', () => {
    it('returns null for anything without a real agent id', () => {
        expect(parseHelpCenterAgent(undefined)).toBeNull();
        expect(parseHelpCenterAgent(null)).toBeNull();
        expect(parseHelpCenterAgent('nope')).toBeNull();
        expect(parseHelpCenterAgent({})).toBeNull();
        expect(parseHelpCenterAgent({ agentId: '', agentName: 'Help Bot' })).toBeNull();
    });

    it('parses a fully stored value', () => {
        expect(parseHelpCenterAgent({ agentId: 'agent-1', agentName: 'Help Bot', agentSlug: 'help-bot' })).toEqual({
            agentId: 'agent-1',
            agentName: 'Help Bot',
            agentSlug: 'help-bot',
        });
    });

    it('tolerates a missing slug rather than rejecting the whole value', () => {
        expect(parseHelpCenterAgent({ agentId: 'agent-1', agentName: 'Help Bot' })).toEqual({
            agentId: 'agent-1',
            agentName: 'Help Bot',
            agentSlug: '',
        });
    });

    it('tolerates a missing name too, since the agent id is what makes the value valid', () => {
        expect(parseHelpCenterAgent({ agentId: 'agent-1' })).toEqual({
            agentId: 'agent-1',
            agentName: '',
            agentSlug: '',
        });
    });

    it('parses the same stored value into equal rows, so a dirty check stays honest', () => {
        const stored = { agentId: 'agent-1', agentName: 'Help Bot', agentSlug: 'help-bot' };

        expect(parseHelpCenterAgent(stored)).toEqual(parseHelpCenterAgent(stored));
    });
});
