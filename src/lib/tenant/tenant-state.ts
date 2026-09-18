import { z } from 'zod';

import type { TenantType } from '@/types/store';

import { parseDocumentationLinks } from './documentation-links';
import { parseHelpCenterAgent } from './help-center-agent';
import { launcherVisibilitySchema, parseLauncherVisibility } from './launcher-visibility';

const tenantPublicSchema = z.looseObject({
    name: z.string().optional().catch(undefined),
    'logo-white': z.string().optional().catch(undefined),
    'logo-brand': z.string().optional().catch(undefined),
    'company-logo': z.string().optional().catch(undefined),
    'company-logo-horizontal': z.string().optional().catch(undefined),
    'login-text': z.string().optional().catch(undefined),
    description: z.string().optional().catch(undefined),
    'company-name': z.string().optional().catch(undefined),
    'logo-horizontal': z.string().optional().catch(undefined),
    'userback-access-token': z.string().optional().catch(undefined),
    'hide-search-bar': launcherVisibilitySchema.optional().catch(undefined),
    'hide-whats-new': launcherVisibilitySchema.optional().catch(undefined),
    'hide-create-agent': launcherVisibilitySchema.optional().catch(undefined),
    'hide-scope-switch': launcherVisibilitySchema.optional().catch(undefined),
    'hide-category-filter': launcherVisibilitySchema.optional().catch(undefined),
    'hide-search-input': launcherVisibilitySchema.optional().catch(undefined),
    'hide-documentation-links': launcherVisibilitySchema.optional().catch(undefined),
    'hide-ai-usage': launcherVisibilitySchema.optional().catch(undefined),
    // Only a genuinely absent key may mean hidden, so a present-but-unparseable value has to land on
    // a real value here rather than on `undefined` — the About form reads the row and shows visible.
    'hide-routines': launcherVisibilitySchema.optional().catch(false),
    'help-url': z.string().optional().catch(undefined),
    'posthog-token': z.string().optional().catch(undefined),
    branding: z.unknown().optional(),
    'font-family': z.string().optional().catch(undefined),
    'title-font-family': z.string().optional().catch(undefined),
    'footer-text': z.string().optional().catch(undefined),
    'title-generation-model': z.string().optional().catch(undefined),
    'default-agent-model': z
        .union([z.string(), z.object({ modelId: z.string(), modelName: z.string().optional() })])
        .optional()
        .catch(undefined),
    'embedding-generation-model': z.string().optional().catch(undefined),
    idps: z.array(z.unknown()).optional().catch(undefined),
    'youtube-video-embeds': z.record(z.string(), z.string()).optional().catch(undefined),
    'documentation-links': z.unknown().optional(),
    'help-center-agent': z.unknown().optional(),
});

const idpSchema = z.object({
    _id: z.string(),
    name: z.string(),
    avatar: z.string().optional(),
});

const mapIdps = (raw: unknown[] | undefined): TenantType['idps'] => {
    if (!raw) {
        return [];
    }

    return raw.flatMap((entry) => {
        const parsed = idpSchema.safeParse(entry);

        if (!parsed.success) {
            return [];
        }

        return [
            {
                _id: parsed.data._id,
                name: parsed.data.name,
                avatar: parsed.data.avatar || '',
            },
        ];
    });
};

/**
 * Routines inverts the `hide-*` convention that an absent key means visible: this ships on the
 * production branch and must stay invisible until an admin deliberately turns it on.
 */
export const ROUTINES_HIDDEN_WHEN_UNSET = true;

const createTenantDefaults = (): TenantType => ({
    name: '',
    logoWhite: '',
    logoBrand: '',
    companyLogo: '',
    companyLogoHorizontal: '',
    loginText: '',
    description: '',
    companyName: '',
    logoHorizontal: '',
    userbackAccessToken: '',
    hideSearchBar: false,
    hideWhatsNew: false,
    hideCreateAgent: false,
    hideScopeSwitch: false,
    hideCategoryFilter: false,
    hideSearchInput: false,
    hideDocumentationLinks: false,
    hideAiUsage: false,
    hideRoutines: ROUTINES_HIDDEN_WHEN_UNSET,
    helpUrl: '',
    postHogToken: '',
    branding: '',
    fontFamily: '',
    titleFontFamily: '',
    titleGenerationModel: '',
    defaultAgentModel: '',
    embeddingGenerationModel: '',
    footerText: '',
    idps: [],
    youtubeVideoEmbeds: {},
    documentationLinks: [],
    helpCenterAgent: null,
});

export const mapTenantPublicToTenant = (raw: unknown): TenantType => {
    const parsed = tenantPublicSchema.safeParse(raw);

    if (!parsed.success) {
        return createTenantDefaults();
    }

    const data = parsed.data;

    return {
        name: data.name || '',
        logoWhite: data['logo-white'] || '',
        logoBrand: data['logo-brand'] || '',
        companyLogo: data['company-logo'] || '',
        companyLogoHorizontal: data['company-logo-horizontal'] || '',
        loginText: data['login-text'] || '',
        description: data.description || '',
        companyName: data['company-name'] || '',
        logoHorizontal: data['logo-horizontal'] || '',
        userbackAccessToken: data['userback-access-token'] || '',
        hideSearchBar: parseLauncherVisibility(data['hide-search-bar']),
        hideWhatsNew: parseLauncherVisibility(data['hide-whats-new']),
        hideCreateAgent: parseLauncherVisibility(data['hide-create-agent']),
        hideScopeSwitch: parseLauncherVisibility(data['hide-scope-switch']),
        hideCategoryFilter: parseLauncherVisibility(data['hide-category-filter']),
        hideSearchInput: parseLauncherVisibility(data['hide-search-input']),
        hideDocumentationLinks: parseLauncherVisibility(data['hide-documentation-links']),
        hideAiUsage: parseLauncherVisibility(data['hide-ai-usage']),
        hideRoutines:
            data['hide-routines'] === undefined
                ? ROUTINES_HIDDEN_WHEN_UNSET
                : parseLauncherVisibility(data['hide-routines']),
        helpUrl: data['help-url'] || '',
        postHogToken: data['posthog-token'] || '',
        branding: data.branding || '',
        fontFamily: data['font-family'] || '',
        titleFontFamily: data['title-font-family'] || '',
        titleGenerationModel: data['title-generation-model'] || '',
        defaultAgentModel: (() => {
            const val = data['default-agent-model'];

            if (!val) return '';
            if (typeof val === 'string') return val;

            return (val as { modelId: string }).modelId || '';
        })(),
        embeddingGenerationModel: data['embedding-generation-model'] || '',
        footerText: data['footer-text'] || '',
        idps: mapIdps(data.idps),
        youtubeVideoEmbeds: data['youtube-video-embeds'] || {},
        documentationLinks: parseDocumentationLinks(data['documentation-links']),
        helpCenterAgent: parseHelpCenterAgent(data['help-center-agent']),
    };
};
