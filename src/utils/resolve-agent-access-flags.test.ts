import { describe, expect, it } from 'vitest';

import type { AgentSettingsType } from '@/types/admin';

import { type AgentAccessFlagsSource, resolveAgentAccessFlags } from './resolve-agent-access-flags';

const makeAgent = (settings: AgentSettingsType | null | undefined): AgentAccessFlagsSource => ({ settings });

describe('resolveAgentAccessFlags', () => {
    it('reads the flags from settings when settings has keys', () => {
        const agent = makeAgent({
            allowCustomSkills: true,
            allowSharedSkills: true,
            allowCustomConnectors: true,
            allowSharedConnectors: true,
        });

        expect(resolveAgentAccessFlags(agent)).toEqual({
            allowCustomSkills: true,
            allowSharedSkills: true,
            allowCustomConnectors: true,
            allowSharedConnectors: true,
        });
    });

    it('treats a partial settings object as authoritative and defaults the rest to false', () => {
        const agent = makeAgent({ allowSharedSkills: true });

        expect(resolveAgentAccessFlags(agent)).toEqual({
            allowCustomSkills: false,
            allowSharedSkills: true,
            allowCustomConnectors: false,
            allowSharedConnectors: false,
        });
    });

    it.each([
        ['an empty settings object', {} as AgentSettingsType],
        ['null settings', null],
        ['absent settings', undefined],
    ])('returns all false for %s (no uiConfig fallback)', (_label, settings) => {
        expect(resolveAgentAccessFlags(makeAgent(settings))).toEqual({
            allowCustomSkills: false,
            allowSharedSkills: false,
            allowCustomConnectors: false,
            allowSharedConnectors: false,
        });
    });
});
