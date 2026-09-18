import type { TenantType, UserState } from '@/types/store';

export const authenticatedUser: UserState = {
    _id: 'user-1',
    name: {
        first: 'Test',
        last: 'User',
        middle: null,
    },
    email: 'test@example.com',
    role: 'user',
    security_groups: [],
    avatar: null,
    isAuthenticated: true,
};

export const testTenant: TenantType = {
    name: 'Fluent Mind',
    logoWhite: '/assets/logo.png',
    logoBrand: '/assets/logo.png',
    companyLogo: '/assets/logo.png',
    companyLogoHorizontal: '',
    loginText: 'Sign in',
    description: 'Test tenant',
    companyName: 'Fluent Mind',
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
    hideRoutines: true,
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
};

/** `testTenant` mirrors production, where Routines is off until an admin enables it. */
export const routinesVisibleTenant: TenantType = { ...testTenant, hideRoutines: false };
