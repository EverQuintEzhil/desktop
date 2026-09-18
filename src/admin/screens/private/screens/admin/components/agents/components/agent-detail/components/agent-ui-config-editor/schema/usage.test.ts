import { describe, expect, it } from 'vitest';

import { validateUiConfigCode } from '../validation';

import { coerceRawUiConfig } from './coerce';
import { DEFAULT_APP_CONFIG, DEFAULT_CHAT_CONFIG, DEFAULT_GALLERY_CONFIG } from './defaults';
import { type AppUiConfig, type ChatUiConfig, type GalleryUiConfig, uiConfigSchema } from './types';

const roundTrip = (raw: unknown) => {
    const coerced = coerceRawUiConfig(raw);
    const result = uiConfigSchema.safeParse(JSON.parse(JSON.stringify(coerced)));

    if (!result.success) throw new Error(result.error.issues.map((issue) => issue.message).join(', '));

    return result.data;
};

describe('usage config survives the coerce → parse round trip', () => {
    it('keeps hidden and visibleToRoles on a chat config', () => {
        const parsed = roundTrip({
            componentType: 'chat',
            usage: { hidden: true, visibleToRoles: ['admin', 'owner'] },
        }) as ChatUiConfig;

        expect(parsed.usage).toEqual({ hidden: true, visibleToRoles: ['admin', 'owner'] });
    });

    it('keeps visibleToRoles on a gallery config', () => {
        const parsed = roundTrip({
            componentType: 'gallery',
            type: 'image',
            usage: { visibleToRoles: ['developer', 'user'] },
        }) as GalleryUiConfig;

        expect(parsed.usage).toEqual({ visibleToRoles: ['developer', 'user'] });
    });

    it('keeps usage on an app config, which inherits the chat fields', () => {
        const parsed = roundTrip({
            componentType: 'app',
            app: { refName: 'dashboard' },
            usage: { hidden: true },
        }) as AppUiConfig;

        expect(parsed.usage).toEqual({ hidden: true });
    });

    it('accepts all four role literals', () => {
        const parsed = roundTrip({
            componentType: 'chat',
            usage: { visibleToRoles: ['admin', 'owner', 'developer', 'user'] },
        }) as ChatUiConfig;

        expect(parsed.usage?.visibleToRoles).toEqual(['admin', 'owner', 'developer', 'user']);
    });

    it('rejects a role outside the four literals', () => {
        const result = uiConfigSchema.safeParse({
            componentType: 'chat',
            type: 'chat',
            home: {},
            usage: { visibleToRoles: ['superuser'] },
        });

        expect(result.success).toBe(false);
    });
});

describe('usage stays absent when nobody configured it', () => {
    it('introduces no usage key on a chat config that has none', () => {
        const parsed = roundTrip({ componentType: 'chat', home: { title: 'Hello' } }) as ChatUiConfig;

        expect(parsed.home.title).toBe('Hello');
        expect(parsed).not.toHaveProperty('usage');
    });

    it('introduces no usage key on a gallery config that has none', () => {
        const parsed = roundTrip({ componentType: 'gallery', type: 'video' }) as GalleryUiConfig;

        expect(parsed.type).toBe('video');
        expect(parsed).not.toHaveProperty('usage');
    });

    it('keeps usage out of the defaults so a new agent gets no opinion', () => {
        expect(DEFAULT_CHAT_CONFIG).not.toHaveProperty('usage');
        expect(DEFAULT_GALLERY_CONFIG).not.toHaveProperty('usage');
        expect(DEFAULT_APP_CONFIG).not.toHaveProperty('usage');
    });
});

describe('the api variant has no usage surface', () => {
    it('strips usage from an api config', () => {
        const parsed = roundTrip({ componentType: 'api', type: 'jsonviewer', usage: { hidden: true } });

        expect(parsed.componentType).toBe('api');
        expect(parsed).not.toHaveProperty('usage');
    });
});

describe('the JSON tab keeps usage', () => {
    it('parses a hand-edited usage block out of raw JSON', () => {
        const result = validateUiConfigCode(
            JSON.stringify({
                componentType: 'chat',
                type: 'chat',
                home: { title: '' },
                usage: { hidden: false, visibleToRoles: ['owner'] },
            }),
        );

        expect(result.success).toBe(true);
        expect(result.success && result.data.componentType === 'chat' && result.data.usage).toEqual({
            hidden: false,
            visibleToRoles: ['owner'],
        });
    });

    it('reports the offending path for an invalid role', () => {
        const result = validateUiConfigCode(
            JSON.stringify({ componentType: 'chat', type: 'chat', home: {}, usage: { visibleToRoles: ['nobody'] } }),
        );

        expect(result.success).toBe(false);
        expect(result.success ? '' : result.message).toContain('usage.visibleToRoles.0');
    });
});
