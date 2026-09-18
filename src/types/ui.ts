import type { Role } from './store';

export type UiComponentType = 'chat' | 'api' | 'gallery' | 'app';
export type ApiUiTypeEnum = 'jsonviewer' | 'markdownviewer' | 'htmlviewer' | 'plaintextviewer';
export type GalleryUiTypeEnum = 'image' | 'video';

export type InputTypeType =
    | 'text'
    | 'textbox'
    | 'radio'
    | 'checkbox'
    | 'number'
    | 'select'
    | 'multiselect'
    | 'filesupload'
    | 'jsoneditor';

export interface FieldType {
    name: string;
    label: string;
    inputType: InputTypeType;
    values: string[];
    accept?: string;
    multiple?: boolean;
    required?: boolean;
}

export type ParameterTypeSelect = {
    type: 'select';
    icon?: string;
    default: { label: string; value: string };
    options: { label: string; value: string }[];
};

export type ParameterTypeRange = {
    type: 'range';
    icon?: string;
    default: number;
    range: {
        min: number;
        max: number;
        step: number;
    };
};

export type ParameterTypeToggle = {
    type: 'toggle';
    icon?: string;
    default: boolean;
    inverse?: boolean;
};

export type ParameterTypeTextbox = {
    component: 'textbox';
    icon?: string;
    type?: string;
};

export type ParameterType = {
    label: string;
    icon?: string;
    showDefault?: boolean;
} & (ParameterTypeSelect | ParameterTypeRange | ParameterTypeToggle | ParameterTypeTextbox);

export interface ModelOptionType {
    mask?: boolean;
    frames?: boolean;
    maxImageUploads?: number;
}

export interface ModelValueType {
    name: string;
    modelId: string;
    parameters?: Record<string, ParameterType>;
    options?: ModelOptionType;
}

export type UiSearchConfigType = {
    placeholder?: string;
    files?: boolean;
    accept?: string;
    showWebSearch?: boolean;
    isWebSearchEnabled?: boolean;
    showDeepSearch?: boolean;
    isDeepSearchEnabled?: boolean;
    isRelatedQuestionsEnabled?: boolean;
    relatedQuestionsCount?: number;
    isIncognitoEnabled?: boolean;
    defaultPrompt?: string;
};

export type UiHomeAppConfigType = {
    refName: string;
    enabled?: boolean;
    prompt?: string;
    dataTool?: {
        refName: string;
        args?: Record<string, unknown>;
    };
};

export type UiHomeConfigType = {
    startPage?: 'library' | 'chat';
    title?: string;
    titleIncognito?: string;
    search?: UiSearchConfigType;
    questions?: string[];
    homeApp?: UiHomeAppConfigType;
};

export type UiFollowUpConfigType = {
    followUp?: boolean;
};

export type UiPromptLibraryConfigType = {
    enabled: boolean;
    filters: {
        aimodelIds: string[];
    };
};

export type UiLibraryConfigType =
    | boolean
    | {
          showFloatingChatBox?: boolean;
          searchPlaceholder?: string;
      };

export type UiProjectsConfigType = {
    enabled: boolean;
};

export type UiRoutinesConfigType = {
    enabled: boolean;
};

/**
 * Per-agent visibility of AI usage figures (tokens, estimated cost, CO2). Absent means visible to
 * everyone, so agents nobody has configured keep today's behaviour.
 */
export type UiUsageConfigType = {
    /** Hides usage for everyone on this agent, whatever `visibleToRoles` says. */
    hidden?: boolean;
    /** Roles allowed to see usage when not hidden. Absent means every role. */
    visibleToRoles?: NonNullable<Role>[];
};

export type BaseAgentUiType = {
    componentType: UiComponentType;
};

export type ChatAgentUiType = BaseAgentUiType & {
    componentType: 'chat';
    type: 'chat';
    // Read out of the uiConfig blob by api `resolve_agent_ui_flags.js` and ai
    // `load_agent_ui_flags.js` whenever `agent.settings` is empty, which is every agent nobody has
    // toggled on the Capabilities tab. Do not remove before those fallbacks go.
    allowCustomConnectors?: boolean;
    allowSharedConnectors?: boolean;
    allowCustomSkills?: boolean;
    allowSharedSkills?: boolean;
    models?: ModelValueType[];
    defaultModel?: ModelValueType;
    home: UiHomeConfigType;
    chat?: UiFollowUpConfigType;
    search?: UiFollowUpConfigType;
    promptLibrary?: UiPromptLibraryConfigType;
    spaces?: UiProjectsConfigType;
    routines?: UiRoutinesConfigType;
    library?: UiLibraryConfigType;
    usage?: UiUsageConfigType;
    parameters?: Record<string, ParameterType>;
};

export type ApiAgentUiType = BaseAgentUiType & {
    componentType: 'api';
    type: ApiUiTypeEnum;
    formSpec?: FieldType[];
    responsePath?: string;
};

export type GalleryAgentUiType = BaseAgentUiType & {
    componentType: 'gallery';
    type: GalleryUiTypeEnum;
    videoAgentSlug?: string;
    models?: ModelValueType[];
    defaultModel?: ModelValueType;
    showPublicPrivateToggle?: boolean;
    isPublic?: boolean;
    defaultVisibilityByTab?: {
        my: boolean;
        fav: boolean;
        firmwide: boolean;
    };
    canUserChangeVisibilityByTab?: {
        my: boolean;
        fav: boolean;
        firmwide: boolean;
    };
    usage?: UiUsageConfigType;
    parameters?: Record<string, ParameterType>;
    promptPlaceholders?: string[];
    quotes?: string[];
};

/** The traditional-app pane of an `app` agent: a full-page GenUI bundle linked to the agent. */
export type UiAppPaneConfigType = {
    /** refName of an agent-linked GenUI app rendered as the main (non-chat) surface. */
    refName: string;
    /** Assistant panel title; defaults to the agent name. */
    assistantLabel?: string;
    /** Whether the assistant panel starts open on first visit. Default true. */
    assistantDefaultOpen?: boolean;
    /**
     * Which side the assistant panel docks on by default. The user can flip it
     * at runtime (persisted per browser). Default 'right' (app on the left).
     */
    assistantSide?: 'left' | 'right';
};

/**
 * `componentType: "app"` — a traditional application with an embedded AI
 * assistant. The main surface is a full-page GenUI bundle (`app.refName`) that
 * talks to the agent's tools directly (`bridge.callApi` → `/ai/apps/tool`,
 * no model in the loop); the chat UI renders beside it as a collapsible
 * assistant panel. All chat fields are the same as a chat agent's.
 */
export type AppAgentUiType = Omit<ChatAgentUiType, 'componentType' | 'type'> & {
    componentType: 'app';
    type: 'app';
    app: UiAppPaneConfigType;
};

export type AgentUiType = ChatAgentUiType | ApiAgentUiType | GalleryAgentUiType | AppAgentUiType;

export type WithChatUi<T extends { uiConfig?: AgentUiType | null }> = T & { uiConfig: ChatAgentUiType };
export type WithApiUi<T extends { uiConfig?: AgentUiType | null }> = T & { uiConfig: ApiAgentUiType };
export type WithGalleryUi<T extends { uiConfig?: AgentUiType | null }> = T & { uiConfig: GalleryAgentUiType };
export type WithAppUi<T extends { uiConfig?: AgentUiType | null }> = T & { uiConfig: AppAgentUiType };

export const hasChatUi = <T extends { uiConfig?: AgentUiType | null }>(value: T): value is WithChatUi<T> =>
    (value.uiConfig?.componentType || '').toLowerCase() === 'chat';

export const hasApiUi = <T extends { uiConfig?: AgentUiType | null }>(value: T): value is WithApiUi<T> =>
    (value.uiConfig?.componentType || '').toLowerCase() === 'api';

export const hasGalleryUi = <T extends { uiConfig?: AgentUiType | null }>(value: T): value is WithGalleryUi<T> =>
    (value.uiConfig?.componentType || '').toLowerCase() === 'gallery';

export const hasAppUi = <T extends { uiConfig?: AgentUiType | null }>(value: T): value is WithAppUi<T> =>
    (value.uiConfig?.componentType || '').toLowerCase() === 'app';
