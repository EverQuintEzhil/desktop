import { describe, expect, it } from 'vitest';

import { coerceRawUiConfig } from './coerce';
import { DEFAULT_CHAT_CONFIG } from './defaults';
import { type ChatUiConfig, uiConfigSchema } from './types';

const asChatConfig = (value: unknown): ChatUiConfig => {
    const result = uiConfigSchema.parse(value);

    if (result.componentType !== 'chat') throw new Error('Expected a chat config');

    return result;
};

describe('coerceRawUiConfig — legacy access flags', () => {
    it('preserves a legacy allowSharedSkills through a coerce round-trip', () => {
        const legacy = { componentType: 'chat', type: 'chat', allowSharedSkills: true };

        const coerced = coerceRawUiConfig(legacy) as ChatUiConfig;

        expect(coerced.allowSharedSkills).toBe(true);
        expect(asChatConfig(JSON.parse(JSON.stringify(coerced))).allowSharedSkills).toBe(true);
    });

    it('preserves all four legacy access flags through a coerce round-trip', () => {
        const legacy = {
            componentType: 'chat',
            allowCustomSkills: true,
            allowSharedSkills: true,
            allowCustomConnectors: true,
            allowSharedConnectors: true,
        };

        const coerced = coerceRawUiConfig(legacy) as ChatUiConfig;

        expect(coerced).toMatchObject({
            allowCustomSkills: true,
            allowSharedSkills: true,
            allowCustomConnectors: true,
            allowSharedConnectors: true,
        });
    });

    it('leaves the flags absent when the source has no opinion', () => {
        const coerced = coerceRawUiConfig({ componentType: 'chat' }) as ChatUiConfig;

        expect(coerced).not.toHaveProperty('allowSharedSkills');
        expect(coerced).not.toHaveProperty('allowCustomSkills');
        expect(coerced).not.toHaveProperty('allowCustomConnectors');
        expect(coerced).not.toHaveProperty('allowSharedConnectors');
    });

    it('keeps the flags out of DEFAULT_CHAT_CONFIG so a new agent gets no opinion', () => {
        expect(DEFAULT_CHAT_CONFIG).not.toHaveProperty('allowSharedSkills');
    });
});
