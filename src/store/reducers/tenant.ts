import { createSlice, type PayloadAction } from '@reduxjs/toolkit';

import { ROUTINES_HIDDEN_WHEN_UNSET } from '@/lib/tenant/tenant-state';
import type { TenantType } from '@/types/store';

interface TenantFontsPayload {
    fontFamily: string;
    titleFontFamily: string;
}

const initialState: TenantType = {
    name: 'Fluent Mind',
    logoWhite: '/assets/logo.png',
    logoBrand: '/assets/logo.png',
    companyLogo: '/assets/logo.png',
    companyLogoHorizontal: '',
    loginText: 'Signin in to access Fluent Mind',
    description: 'Driving Business Through AI Flows',
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
    hideRoutines: ROUTINES_HIDDEN_WHEN_UNSET,
    postHogToken: '',
    fontFamily: '',
    titleFontFamily: '',
    helpUrl: '',
    branding: '',
    titleGenerationModel: '',
    defaultAgentModel: '',
    embeddingGenerationModel: '',
    footerText: '',
    idps: [],
    youtubeVideoEmbeds: {},
    documentationLinks: [],
    helpCenterAgent: null,
};

const tenantSlice = createSlice({
    name: 'tenant',
    initialState,
    reducers: {
        setTenant(state, action: PayloadAction<TenantType>) {
            const payload = action.payload;

            state.name = payload.name;
            state.logoWhite = payload.logoWhite;
            state.logoBrand = payload.logoBrand;
            state.companyLogo = payload.companyLogo;
            state.companyLogoHorizontal = payload.companyLogoHorizontal;
            state.loginText = payload.loginText;
            state.description = payload.description;
            state.companyName = payload.companyName;
            state.logoHorizontal = payload.logoHorizontal;
            state.userbackAccessToken = payload.userbackAccessToken;
            state.hideSearchBar = payload.hideSearchBar;
            state.hideWhatsNew = payload.hideWhatsNew;
            state.hideCreateAgent = payload.hideCreateAgent;
            state.hideScopeSwitch = payload.hideScopeSwitch;
            state.hideCategoryFilter = payload.hideCategoryFilter;
            state.hideSearchInput = payload.hideSearchInput;
            state.hideDocumentationLinks = payload.hideDocumentationLinks;
            state.hideAiUsage = payload.hideAiUsage;
            state.hideRoutines = payload.hideRoutines;
            state.helpUrl = payload.helpUrl;
            state.postHogToken = payload.postHogToken;
            state.branding = payload.branding;
            state.fontFamily = payload.fontFamily;
            state.titleFontFamily = payload.titleFontFamily;
            state.titleGenerationModel = payload.titleGenerationModel;
            state.defaultAgentModel = payload.defaultAgentModel;
            state.embeddingGenerationModel = payload.embeddingGenerationModel;
            state.footerText = payload.footerText;
            state.idps = payload.idps;
            state.youtubeVideoEmbeds = payload.youtubeVideoEmbeds;
            state.documentationLinks = payload.documentationLinks;
            state.helpCenterAgent = payload.helpCenterAgent;
        },
        setTenantBranding(state, action: PayloadAction<TenantType['branding']>) {
            state.branding = action.payload;
        },
        setTenantFonts(state, action: PayloadAction<TenantFontsPayload>) {
            state.fontFamily = action.payload.fontFamily;
            state.titleFontFamily = action.payload.titleFontFamily;
        },
    },
});

export default tenantSlice.reducer;
export const { setTenant, setTenantBranding, setTenantFonts } = tenantSlice.actions;
