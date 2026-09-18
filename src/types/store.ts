import type { DocumentationLink } from '@/lib/tenant/documentation-links';
import type { HelpCenterAgent } from '@/lib/tenant/help-center-agent';
import type { store } from '@/store';

export type Role = 'admin' | 'owner' | 'developer' | 'user' | null;

export type LauncherRole = NonNullable<Role>;

/**
 * A tenant "hide" setting. `false`/absent shows it, `true` hides it from everyone, and the object
 * form narrows it: `visibleToRoles` lists the roles that can still see it, absent meaning all of
 * them. Interface level only — nothing here is enforced by the API.
 */
export type LauncherVisibility =
    | boolean
    | {
          hidden?: boolean;
          visibleToRoles?: LauncherRole[];
      };

export interface UserState {
    _id: string | null;
    name: {
        first: string | null;
        last: string | null;
        middle: string | null;
    };
    email: string | null;
    role: Role;
    avatar?: string | null;
    security_groups?: string[] | null;
    isAuthenticated: boolean;
}

export interface TenantType {
    name: string;
    logoWhite: string;
    logoBrand: string;
    companyLogo: string;
    companyLogoHorizontal: string;
    loginText: string;
    description: string;
    companyName: string;
    logoHorizontal: string;
    userbackAccessToken: string;
    hideSearchBar: LauncherVisibility;
    hideWhatsNew: LauncherVisibility;
    hideCreateAgent: LauncherVisibility;
    hideScopeSwitch: LauncherVisibility;
    hideCategoryFilter: LauncherVisibility;
    hideSearchInput: LauncherVisibility;
    hideDocumentationLinks: LauncherVisibility;
    hideAiUsage: LauncherVisibility;
    hideRoutines: LauncherVisibility;
    helpUrl: string;
    postHogToken: string;
    branding: unknown;
    fontFamily: string;
    titleFontFamily: string;
    titleGenerationModel: string;
    defaultAgentModel: string;
    embeddingGenerationModel: string;
    footerText: string;
    idps: { _id: string; name: string; avatar: string }[];
    youtubeVideoEmbeds: Record<string, string>;
    documentationLinks: DocumentationLink[];
    helpCenterAgent: HelpCenterAgent | null;
}

export type RootState = ReturnType<typeof store.getState>;
export type AppDispatch = typeof store.dispatch;
