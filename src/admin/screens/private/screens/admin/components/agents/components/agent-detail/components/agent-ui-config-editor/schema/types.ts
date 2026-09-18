import { z } from 'zod';

export const COMPONENT_TYPES = ['chat', 'api', 'gallery', 'app'] as const;
export type ComponentType = (typeof COMPONENT_TYPES)[number];

export const API_TYPES = ['jsonviewer', 'markdownviewer', 'htmlviewer', 'plaintextviewer'] as const;
export const GALLERY_TYPES = ['image', 'video'] as const;

export const INPUT_TYPES = [
    'text',
    'textbox',
    'radio',
    'checkbox',
    'number',
    'select',
    'multiselect',
    'filesupload',
    'jsoneditor',
] as const;

const requiredString = (fieldName: string) => z.string().trim().min(1, `${fieldName} is required.`);

const parameterSelectSchema = z.object({
    type: z.literal('select').optional().default('select'),
    label: requiredString('Parameter label').describe('Human-readable name shown in the options menu.'),
    icon: z.string().optional().describe('Icon name (FontAwesome).'),
    showDefault: z.boolean().optional(),
    default: z.object({ label: z.string(), value: z.union([z.string(), z.number()]) }),
    options: z.array(z.object({ label: z.string(), value: z.union([z.string(), z.number()]) })),
});

const parameterRangeSchema = z.object({
    type: z.literal('range'),
    label: requiredString('Parameter label'),
    icon: z.string().optional(),
    showDefault: z.boolean().optional(),
    default: z.number(),
    range: z.object({
        min: z.number(),
        max: z.number(),
        step: z.number(),
    }),
});

const parameterToggleSchema = z.object({
    type: z.literal('toggle'),
    label: requiredString('Parameter label'),
    icon: z.string().optional(),
    showDefault: z.boolean().optional(),
    default: z.boolean(),
    inverse: z.boolean().optional(),
});

const parameterTextboxSchema = z.object({
    component: z.literal('textbox'),
    label: requiredString('Parameter label'),
    icon: z.string().optional(),
    type: z.string().optional(),
});

export const parameterSchema = z.union([
    parameterRangeSchema,
    parameterSelectSchema,
    parameterToggleSchema,
    parameterTextboxSchema,
]);
export type ParameterSchemaType = z.infer<typeof parameterSchema>;

const parameterRecordSchema = z.record(requiredString('Parameter key'), parameterSchema);

const modelOptionsSchema = z.object({
    mask: z.boolean().optional(),
    frames: z.boolean().optional(),
    maxImageUploads: z.number().int().min(1).optional(),
});

const modelValueSchema = z.object({
    name: requiredString('Display name').describe('Display label shown in the model selector.'),
    modelId: requiredString('Model').describe('Model _id from the models collection.'),
    parameters: parameterRecordSchema
        .optional()
        .describe('Per-model parameters that override the top-level parameter config.'),
    options: modelOptionsSchema.optional().describe('Per-model UI options.'),
});

export type ModelValueSchemaType = z.infer<typeof modelValueSchema>;

export const fieldSpecSchema = z.object({
    name: requiredString('Field name').describe('Unique key used when submitting the form.'),
    label: requiredString('Field label').describe('Human-readable label shown above the input.'),
    inputType: z.enum(INPUT_TYPES),
    values: z.array(z.string()).default([]).describe('Allowed values for select/radio/checkbox/multiselect.'),
    accept: z.string().optional().describe('Accepted MIME types (filesupload only).'),
    multiple: z.boolean().optional(),
    required: z.boolean().optional(),
});
export type FieldSpecSchemaType = z.infer<typeof fieldSpecSchema>;

const searchSchema = z.object({
    placeholder: z.string().optional(),
    files: z.boolean().optional(),
    accept: z.string().optional().describe('Accepted MIME types for file upload.'),
    showWebSearch: z.boolean().optional(),
    isWebSearchEnabled: z.boolean().optional(),
    showDeepSearch: z.boolean().optional(),
    isDeepSearchEnabled: z.boolean().optional(),
    isRelatedQuestionsEnabled: z.boolean().optional(),
    relatedQuestionsCount: z.number().int().min(1).max(5).optional(),
    isIncognitoEnabled: z.boolean().optional(),
    defaultPrompt: z.string().optional().describe('Prefilled prompt shown in the search input on first visit.'),
});

const homeAppSchema = z.object({
    refName: z.string().min(1),
    enabled: z.boolean().optional(),
    prompt: z.string().optional(),
    dataTool: z
        .object({
            refName: z.string().min(1),
            args: z.record(z.string(), z.unknown()).optional(),
        })
        .optional(),
});

const homeSchema = z.object({
    startPage: z.enum(['library', 'chat']).optional().describe('Which tab should load first when the agent opens.'),
    title: z.string().optional().describe('Main title shown on the agent home page.'),
    titleIncognito: z.string().optional().describe('Title shown when incognito mode is active.'),
    search: searchSchema.optional(),
    questions: z.array(z.string()).optional().describe('Suggested starter questions shown to the user.'),
    homeApp: homeAppSchema.optional().describe('GenUI app shown as the agent home/landing screen.'),
});

const libraryObjectSchema = z.object({
    showFloatingChatBox: z.boolean().optional(),
    searchPlaceholder: z.string().optional(),
});

export const librarySchema = z.union([z.boolean(), libraryObjectSchema]);

const promptLibrarySchema = z.object({
    enabled: z.boolean().default(false),
    filters: z
        .object({
            aimodelIds: z.array(z.string()).default([]),
        })
        .default({ aimodelIds: [] }),
});

const projectsSchema = z.object({
    enabled: z.boolean().default(false),
});

// Unlike `spaces`, absent means on — every agent already has routines, so only an explicit `false` takes it away.
const routinesSchema = z.object({
    enabled: z.boolean().default(true),
});

const followUpSchema = z.object({
    followUp: z.boolean().optional(),
});

export const USAGE_ROLES = ['admin', 'owner', 'developer', 'user'] as const;

const usageSchema = z.object({
    hidden: z
        .boolean()
        .optional()
        .describe('Hide AI usage for everyone on this agent, whatever `visibleToRoles` says.'),
    visibleToRoles: z
        .array(z.enum(USAGE_ROLES))
        .optional()
        .describe('Roles allowed to see AI usage when it is not hidden. Absent means every role.'),
});
export type UsageSchemaType = z.infer<typeof usageSchema>;

const chatUiSchema = z.object({
    componentType: z.literal('chat'),
    type: z.literal('chat').default('chat'),
    models: z.array(modelValueSchema).optional(),
    defaultModel: modelValueSchema.optional(),
    home: homeSchema.default({}),
    chat: followUpSchema.optional(),
    search: followUpSchema.optional(),
    // No section edits these — they are on the Capabilities tab, which writes `agent.settings`.
    // They must stay in the schema anyway: zod strips unknown keys and the editor re-serialises what
    // it parsed, so dropping them here would wipe the uiConfig blob that api
    // `resolve_agent_ui_flags.js` and ai `load_agent_ui_flags.js` still fall back to whenever
    // `agent.settings` is empty. No `.default(false)` — that would invent an opinion.
    allowCustomConnectors: z.boolean().optional(),
    allowCustomSkills: z.boolean().optional(),
    allowSharedSkills: z.boolean().optional(),
    allowSharedConnectors: z.boolean().optional(),
    promptLibrary: promptLibrarySchema.optional(),
    spaces: projectsSchema.optional(),
    routines: routinesSchema.optional(),
    library: librarySchema.optional(),
    usage: usageSchema.optional().describe('Who can see AI usage figures (tokens, estimated cost, CO2).'),
    parameters: parameterRecordSchema.optional(),
});

const apiUiSchema = z.object({
    componentType: z.literal('api'),
    type: z
        .enum(API_TYPES)
        .default('jsonviewer')
        .describe('How API responses should be rendered in the response panel.'),
    formSpec: z.array(fieldSpecSchema).default([]),
    responsePath: z.string().optional().describe('Dot path into the API response used to locate the rendered value.'),
});

const galleryUiSchema = z.object({
    componentType: z.literal('gallery'),
    type: z
        .enum(GALLERY_TYPES)
        .default('image')
        .describe(
            'Gallery sub-variant. ' +
                '`image-generation`/`image` → image gallery; ' +
                '`video-generation`/`video` → video gallery; ' +
                '`image-editing` → image-edit flow.',
        ),
    models: z.array(modelValueSchema).optional().describe('Models available in the gallery prompt panel.'),
    defaultModel: modelValueSchema
        .optional()
        .describe('Model pre-selected when the gallery opens. Falls back to the first entry in `models`.'),
    parameters: parameterRecordSchema
        .optional()
        .describe('Extra controls (select/range) shown in the "+ More" panel; merged into the generation request.'),
    promptPlaceholders: z
        .array(z.string())
        .optional()
        .describe('Pool of placeholder strings for the prompt textarea; one is chosen at random per session.'),
    quotes: z
        .array(z.string())
        .optional()
        .describe('Pool of quotes shown in the masonry empty-state; one is chosen at random per session.'),
    videoAgentSlug: z
        .string()
        .optional()
        .describe('Slug of the video agent opened when a user converts an image to video from the lightbox.'),
    showPublicPrivateToggle: z
        .boolean()
        .optional()
        .describe('Show the public/private switch in the gallery prompt input.'),
    isPublic: z
        .boolean()
        .optional()
        .describe('Initial state of the public/private toggle and the default visibility of generated items.'),
    defaultVisibilityByTab: z
        .object({
            my: z.boolean().default(false),
            fav: z.boolean().default(false),
            firmwide: z.boolean().default(true),
        })
        .optional()
        .describe('Default public/private state for each tab.'),
    canUserChangeVisibilityByTab: z
        .object({
            my: z.boolean().default(true),
            fav: z.boolean().default(true),
            firmwide: z.boolean().default(false),
        })
        .optional()
        .describe('Whether the end user can change the public/private state for each tab.'),
    usage: usageSchema.optional().describe('Who can see AI usage figures (tokens, estimated cost, CO2).'),
});

// componentType "app": a traditional application (full-page GenUI bundle) with the
// chat docked as a collapsible assistant panel. Carries the same chat fields plus
// the `app` section naming the bundle.
const appUiSchema = chatUiSchema.extend({
    componentType: z.literal('app'),
    type: z.literal('app').default('app'),
    app: z
        .object({
            // Empty is tolerated so an admin can save the type first and pick the
            // app after; the runtime pane shows a "no app configured" notice.
            refName: z
                .string()
                .default('')
                .describe('refName of an agent-linked GenUI app rendered as the main surface.'),
            assistantLabel: z.string().optional().describe('Assistant panel title; defaults to the agent name.'),
            assistantDefaultOpen: z
                .boolean()
                .optional()
                .describe('Whether the assistant panel starts open on first visit. Default true.'),
            assistantSide: z
                .enum(['left', 'right'])
                .optional()
                .describe(
                    'Which side the assistant panel docks on by default. Users can flip it (persisted per browser). Default right.',
                ),
        })
        .describe('The traditional-app pane rendered beside the assistant.'),
});

export const uiConfigSchema = z.discriminatedUnion('componentType', [
    chatUiSchema,
    apiUiSchema,
    galleryUiSchema,
    appUiSchema,
]);

export type UiConfig = z.infer<typeof uiConfigSchema>;
export type ChatUiConfig = z.infer<typeof chatUiSchema>;
export type ApiUiConfig = z.infer<typeof apiUiSchema>;
export type GalleryUiConfig = z.infer<typeof galleryUiSchema>;
export type AppUiConfig = z.infer<typeof appUiSchema>;

export type ModelValueShape = NonNullable<Extract<UiConfig, { componentType: 'chat' }>['models']>[number];

export type ModelsEditorComponentType = Extract<UiConfig, { componentType: 'chat' | 'gallery' }>['componentType'];
