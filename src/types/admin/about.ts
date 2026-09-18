import type { UserType } from './users';

export type KeyType =
    | 'name'
    | 'logo-white'
    | 'logo-brand'
    | 'company-logo'
    | 'company-logo-horizontal'
    | 'description'
    | 'login-text'
    | 'company-name'
    | 'logo-horizontal'
    | 'userback-access-token'
    | 'posthog-token'
    | 'font-family'
    | 'title-font-family'
    | 'title-generation-model'
    | 'okf-generation-model'
    | 'default-agent-model'
    | 'embedding-generation-model'
    | 'image-prompt-rewrite-model'
    | 'video-prompt-rewrite-model'
    | 'memory-default-model'
    | 'hide-search-bar'
    | 'hide-whats-new'
    | 'hide-create-agent'
    | 'hide-scope-switch'
    | 'hide-category-filter'
    | 'hide-search-input'
    | 'hide-documentation-links'
    | 'hide-ai-usage'
    | 'hide-routines'
    | 'help-url'
    | 'branding'
    | 'builder-agent-models'
    | 'footer-text'
    | 'youtube-video-embeds'
    | 'documentation-links'
    | 'user-profile-schema'
    | 'help-center-agent';

export const YOUTUBE_VIDEO_EMBED_KEYS = {
    memory: 'memory',
    skills: 'skills',
    connectors: 'connectors',
    spaces: 'spaces',
} as const;

export type YoutubeVideoEmbedKey = (typeof YOUTUBE_VIDEO_EMBED_KEYS)[keyof typeof YOUTUBE_VIDEO_EMBED_KEYS];

export const YOUTUBE_VIDEO_EMBED_OPTIONS: Array<{ value: YoutubeVideoEmbedKey; label: string }> = [
    { value: YOUTUBE_VIDEO_EMBED_KEYS.memory, label: 'Memory' },
    { value: YOUTUBE_VIDEO_EMBED_KEYS.skills, label: 'Skills' },
    { value: YOUTUBE_VIDEO_EMBED_KEYS.connectors, label: 'Connectors' },
    { value: YOUTUBE_VIDEO_EMBED_KEYS.spaces, label: 'Spaces' },
];

export type AboutType = {
    readonly _id: string;
    key: KeyType;
    value: unknown;
    booleanValue: boolean;
    isPublic: boolean;
    creatorId: UserType;
    updatedById: UserType;
    creator: UserType;
    updatedBy: UserType;
    createdAt: string;
    updatedAt: string;
};
export const ABOUT_GROUPS = {
    launcher: 'launcher',
    chat: 'chat',
    branding: 'branding',
    models: 'models',
    integrations: 'integrations',
    documentation: 'documentation',
    userProfile: 'user-profile',
    agent: 'agent',
} as const;

export type AboutGroup = (typeof ABOUT_GROUPS)[keyof typeof ABOUT_GROUPS];

export const ABOUT_GROUP_OPTIONS: Array<{ value: AboutGroup; label: string }> = [
    { value: ABOUT_GROUPS.branding, label: 'Branding' },
    { value: ABOUT_GROUPS.launcher, label: 'Launcher' },
    { value: ABOUT_GROUPS.chat, label: 'Chat' },
    { value: ABOUT_GROUPS.models, label: 'Models' },
    { value: ABOUT_GROUPS.integrations, label: 'Integrations' },
    { value: ABOUT_GROUPS.documentation, label: 'Documentation Links' },
    { value: ABOUT_GROUPS.userProfile, label: 'User Profile Schema' },
    { value: ABOUT_GROUPS.agent, label: 'Agent' },
];

export const ABOUT_SECTIONS = {
    identity: 'identity',
    logos: 'logos',
    typography: 'typography',
} as const;

export type AboutSection = (typeof ABOUT_SECTIONS)[keyof typeof ABOUT_SECTIONS];

export const ABOUT_SECTION_LABELS: Record<AboutSection, string> = {
    identity: 'Identity',
    logos: 'Logos',
    typography: 'Typography & Theme',
};

export type KeyListType = {
    value: KeyType;
    label: string;
    description: string;
    group: AboutGroup;
    section?: AboutSection;
    inputType: string;
    /**
     * What a `visibility-check-box` key means when no About row exists. Absent is visible, which is
     * what every `hide-*` key but Routines relies on. `src/types` must not import app code, so a
     * value set here is held to its reader's constant by about.test.ts instead.
     */
    hiddenWhenUnset?: boolean;
    notEditable?: boolean;
    accept?: string;
    isPublic: boolean;
};

export const KEY_LIST: KeyListType[] = [
    {
        value: 'name',
        description: 'The tenant name shown in the browser tab, the home search box and the About menu.',
        section: ABOUT_SECTIONS.identity,
        group: ABOUT_GROUPS.branding,
        label: 'Name',
        inputType: 'text-input',
        isPublic: true,
    },
    {
        value: 'logo-white',
        description: 'Logo used on dark backgrounds — the sidebars and the dark-mode browser icon.',
        section: ABOUT_SECTIONS.logos,
        group: ABOUT_GROUPS.branding,
        label: 'Logo White',
        inputType: 'file-input',
        isPublic: true,
        accept: 'image/*',
    },
    {
        value: 'logo-brand',
        description: 'Logo used for the light-mode browser icon and the agent builder start screen.',
        section: ABOUT_SECTIONS.logos,
        group: ABOUT_GROUPS.branding,
        label: 'Logo Brand',
        inputType: 'file-input',
        isPublic: true,
        accept: 'image/*',
    },
    {
        value: 'company-logo',
        description: 'Square company mark used as the assistant avatar when no other logo is set.',
        section: ABOUT_SECTIONS.logos,
        group: ABOUT_GROUPS.branding,
        label: 'Company Logo',
        inputType: 'file-input',
        isPublic: true,
        accept: 'image/*',
    },
    {
        value: 'company-logo-horizontal',
        description: 'Wide company mark held for future use — no screen shows it today.',
        section: ABOUT_SECTIONS.logos,
        group: ABOUT_GROUPS.branding,
        label: 'Company Logo Horizontal',
        inputType: 'file-input',
        isPublic: true,
        accept: 'image/*',
    },
    {
        value: 'company-name',
        description: 'Name used in the copyright line at the bottom of the sign-in pages.',
        section: ABOUT_SECTIONS.identity,
        group: ABOUT_GROUPS.branding,
        label: 'Company Name',
        inputType: 'text-input',
        isPublic: true,
    },
    {
        value: 'description',
        description: 'Short tagline shown after the name in the browser tab.',
        section: ABOUT_SECTIONS.identity,
        group: ABOUT_GROUPS.branding,
        label: 'Description',
        inputType: 'text-area',
        isPublic: true,
    },
    {
        value: 'login-text',
        description: 'Heading shown above the form on the sign-in screen.',
        section: ABOUT_SECTIONS.identity,
        group: ABOUT_GROUPS.branding,
        label: 'Login Text',
        inputType: 'text-area',
        isPublic: true,
    },
    {
        value: 'logo-horizontal',
        description: 'Main wide logo shown on the sign-in page, the home banner and the library.',
        section: ABOUT_SECTIONS.logos,
        group: ABOUT_GROUPS.branding,
        label: 'Logo Horizontal',
        inputType: 'file-input',
        isPublic: true,
        accept: 'image/*',
    },
    {
        value: 'userback-access-token',
        description: 'Turns on the Userback feedback widget for signed-in users.',
        group: ABOUT_GROUPS.integrations,
        label: 'User Back Token',
        inputType: 'text-input',
        isPublic: true,
    },
    {
        value: 'posthog-token',
        description: 'Turns on PostHog product analytics and identifies signed-in users.',
        group: ABOUT_GROUPS.integrations,
        label: 'PostHog Token',
        inputType: 'text-input',
        isPublic: true,
    },
    {
        value: 'font-family',
        description: 'Loads and applies the font chosen for this tenant across the app.',
        section: ABOUT_SECTIONS.typography,
        group: ABOUT_GROUPS.branding,
        label: 'Font Family',
        inputType: 'text-area',
        notEditable: true,
        isPublic: true,
    },
    {
        value: 'title-font-family',
        description: 'Font intended for headings — nothing in the app applies it yet.',
        section: ABOUT_SECTIONS.typography,
        group: ABOUT_GROUPS.branding,
        label: 'Title Font Family',
        inputType: 'text-input',
        notEditable: true,
        isPublic: true,
    },
    {
        value: 'title-generation-model',
        description: 'Model the backend uses to name conversations automatically.',
        group: ABOUT_GROUPS.models,
        label: 'Title Generation Model',
        inputType: 'select-input',
        isPublic: false,
    },
    {
        value: 'okf-generation-model',
        description: 'Model the backend uses to generate OKF content for data stores.',
        group: ABOUT_GROUPS.models,
        label: 'OKF Generation Model',
        inputType: 'select-input',
        isPublic: false,
    },
    {
        value: 'default-agent-model',
        description: 'Model pre-selected when someone creates a new agent.',
        group: ABOUT_GROUPS.models,
        label: 'Default Agent Model',
        inputType: 'select-input',
        isPublic: true,
    },
    {
        value: 'builder-agent-models',
        description: 'Models offered in the model picker inside the agent builder chat.',
        group: ABOUT_GROUPS.models,
        label: 'Builder Agent Models',
        inputType: 'multi-select-input',
        isPublic: true,
    },
    {
        value: 'embedding-generation-model',
        description: 'Model the backend uses to turn documents into embeddings for search.',
        group: ABOUT_GROUPS.models,
        label: 'Embedding Generation Model',
        inputType: 'select-input',
        isPublic: false,
    },
    {
        value: 'image-prompt-rewrite-model',
        description: 'Model the backend uses to rewrite a prompt before generating an image.',
        group: ABOUT_GROUPS.models,
        label: 'Image Prompt Rewrite Model',
        inputType: 'select-input',
        isPublic: false,
    },
    {
        value: 'video-prompt-rewrite-model',
        description: 'Model the backend uses to rewrite a prompt before generating a video.',
        group: ABOUT_GROUPS.models,
        label: 'Video Prompt Rewrite Model',
        inputType: 'select-input',
        isPublic: false,
    },
    {
        value: 'memory-default-model',
        description: 'Model the backend uses to extract and recall memories.',
        group: ABOUT_GROUPS.models,
        label: 'Memory Default Model',
        inputType: 'select-input',
        isPublic: false,
    },
    {
        value: 'hide-search-bar',
        description: 'The whole search row on the home screen — category filter, search box and Create Agent button.',
        group: ABOUT_GROUPS.launcher,
        label: 'Search Row',
        inputType: 'visibility-check-box',
        isPublic: true,
    },
    {
        value: 'hide-whats-new',
        description: "The What's New button, the blog pages and announcement pop-ups.",
        group: ABOUT_GROUPS.launcher,
        label: "What's New",
        inputType: 'visibility-check-box',
        isPublic: true,
    },
    {
        value: 'hide-create-agent',
        description: 'The Create Agent button and creating a new agent. Editing an existing agent is unaffected.',
        group: ABOUT_GROUPS.launcher,
        label: 'Create Agent Button',
        inputType: 'visibility-check-box',
        isPublic: true,
    },
    {
        value: 'hide-scope-switch',
        description: 'The My/Firmwide switch on the home screen. Roles without it see firmwide agents only.',
        group: ABOUT_GROUPS.launcher,
        label: 'My/Firmwide Switch',
        inputType: 'visibility-check-box',
        isPublic: true,
    },
    {
        value: 'hide-category-filter',
        description: 'The category dropdown next to the home search box.',
        group: ABOUT_GROUPS.launcher,
        label: 'Category Filter',
        inputType: 'visibility-check-box',
        isPublic: true,
    },
    {
        value: 'hide-search-input',
        description: 'The search box on the home screen.',
        group: ABOUT_GROUPS.launcher,
        label: 'Search Box',
        inputType: 'visibility-check-box',
        isPublic: true,
    },
    {
        value: 'hide-documentation-links',
        description: 'The About dropdown on the home screen that lists the documentation links.',
        group: ABOUT_GROUPS.launcher,
        label: 'About Menu',
        inputType: 'visibility-check-box',
        isPublic: true,
    },
    {
        value: 'hide-routines',
        description:
            'Routines — the scheduled-prompt screens, menus and buttons — everywhere in the product, for everyone in this tenant. Routines start hidden from everyone: switch this to Everyone or to chosen roles to turn them on. This is separate from each agent turning Routines off for itself; whichever one hides wins.',
        group: ABOUT_GROUPS.chat,
        label: 'Routines',
        inputType: 'visibility-check-box',
        hiddenWhenUnset: true,
        isPublic: true,
    },
    {
        value: 'hide-ai-usage',
        description:
            'AI usage figures — token counts, estimated cost and CO2 — in the conversation header, the message and recents menus, and the image and video viewer. An agent can also hide them on its own; the stricter of the two wins.',
        group: ABOUT_GROUPS.chat,
        label: 'AI Usage Figures',
        inputType: 'visibility-check-box',
        isPublic: true,
    },
    {
        value: 'help-url',
        description: 'Address of your help site — no screen links to it yet.',
        group: ABOUT_GROUPS.integrations,
        label: 'Help URL',
        inputType: 'text-input',
        isPublic: true,
    },
    {
        value: 'branding',
        description: 'Generated colour tokens that theme the whole app in light and dark mode.',
        section: ABOUT_SECTIONS.typography,
        group: ABOUT_GROUPS.branding,
        label: 'Branding',
        inputType: 'json-input',
        notEditable: true,
        isPublic: true,
    },
    {
        value: 'footer-text',
        description: 'Disclaimer shown under the chat box, in place of the default note that AI can make mistakes.',
        section: ABOUT_SECTIONS.identity,
        group: ABOUT_GROUPS.branding,
        label: 'Footer Text',
        inputType: 'text-input',
        isPublic: true,
    },
    {
        value: 'youtube-video-embeds',
        description: 'Adds a Learn more video link to the Memory, Skills, Connectors and Spaces screens.',
        group: ABOUT_GROUPS.integrations,
        label: 'Youtube Video Embeds',
        inputType: 'key-value-input',
        isPublic: true,
    },
    {
        value: 'documentation-links',
        description:
            'Documents listed in the About menu on the home screen. Each entry is a label plus an uploaded file or a link, and the order here is the order in the menu.',
        group: ABOUT_GROUPS.documentation,
        label: 'Documentation Links',
        inputType: 'doc-links-input',
        isPublic: true,
    },
    {
        value: 'user-profile-schema',
        description: 'Defines the extra profile fields users can fill in and what counts as a valid value.',
        label: 'User Profile Schema',
        group: ABOUT_GROUPS.userProfile,
        inputType: 'json-input',
        isPublic: false,
    },
    {
        value: 'help-center-agent',
        description: "The agent the Ask button on help-center articles opens, with the reader's question pre-filled.",
        group: ABOUT_GROUPS.agent,
        label: 'Help Center Agent',
        inputType: 'agent-select-input',
        isPublic: true,
    },
];

const KEY_GROUP_BY_VALUE = new Map<string, AboutGroup>(KEY_LIST.map((key) => [key.value, key.group]));

/** Rows can carry a key the frontend does not know yet; they surface under Integrations rather than vanish. */
export const getAboutKeyGroup = (key: string): AboutGroup => KEY_GROUP_BY_VALUE.get(key) ?? ABOUT_GROUPS.integrations;
