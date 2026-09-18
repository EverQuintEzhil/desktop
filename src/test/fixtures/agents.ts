import type { AgentType, LauncherType } from '@/types/admin';
import type { PageInfo } from '@/types/api-types';

export const emptyPageInfo: PageInfo = {
    page: 0,
    totalPages: 1,
    totalCount: 0,
};

export const emptyLaunchersResponse = {
    values: [] as LauncherType[],
    pageInfo: emptyPageInfo,
};

export const emptyTagsResponse = {
    values: [],
};

export const sampleLauncher = {
    _id: 'launcher-1',
    name: 'Research Assistant',
    urlOrSlug: 'research-assistant',
    description: 'Helps with research tasks',
    detailedDescription: 'Detailed research help',
    sortOrder: 0,
    agent: { _id: 'agent-1' },
    includeUsers: [],
    includeSecurityGroups: [],
    excludeUsers: [],
    excludeSecurityGroups: [],
    tags: [],
    isPublished: true,
    type: 'agent',
    creator: { _id: 'user-1' },
    updatedBy: { _id: 'user-1' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
} as unknown as LauncherType;

export const launchersResponse = {
    values: [sampleLauncher],
    pageInfo: emptyPageInfo,
};

const baseAgent = {
    _id: 'agent-1',
    name: 'Smoke Test Agent',
    description: 'Agent used for shell smoke tests',
    models: [],
    admins: [],
    includeUsers: [],
    includeSecurityGroups: [],
    excludeUsers: [],
    excludeSecurityGroups: [],
    tags: [],
    dynamicFields: [],
    isPublished: true,
    historyEnabled: false,
    historySpec: {},
    conversationsEnabled: true,
    type: 'chat',
    dev: false,
    isDeleted: false,
    creator: { _id: 'user-1' },
    updatedBy: { _id: 'user-1' },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
};

export const agentWithoutUi = {
    ...baseAgent,
    uiConfig: null,
} as unknown as AgentType;

export const chatAgent = {
    ...baseAgent,
    uiConfig: {
        componentType: 'chat',
        type: 'chat',
        home: {
            title: 'Chat home',
            search: { placeholder: 'Ask anything' },
        },
    },
} as unknown as AgentType;

export const galleryAgent = {
    ...baseAgent,
    _id: 'gallery-agent-1',
    name: 'Gallery Agent',
    uiConfig: {
        componentType: 'gallery',
        type: 'image',
        models: [],
    },
} as unknown as AgentType;

const galleryModel = {
    name: 'Imagen',
    modelId: 'model-1',
    options: {},
};

/**
 * Gallery agents used by the gallery sub-route tests. `quotes` and
 * `promptPlaceholders` are single-entry on purpose: both components pick a
 * random entry at mount, so a one-item list is the only way the rendered text
 * is assertable.
 */
export const galleryImageAgent = {
    ...baseAgent,
    _id: 'gallery-agent-1',
    name: 'Gallery Agent',
    slug: 'gallery-agent',
    uiConfig: {
        componentType: 'gallery',
        type: 'image',
        models: [galleryModel],
        quotes: ['Nothing here yet'],
        promptPlaceholders: ['Describe an image'],
    },
} as unknown as AgentType;

export const galleryVideoAgent = {
    ...baseAgent,
    _id: 'gallery-video-agent-1',
    name: 'Video Gallery Agent',
    slug: 'video-gallery-agent',
    uiConfig: {
        componentType: 'gallery',
        type: 'video',
        models: [{ ...galleryModel, name: 'Veo', modelId: 'video-model-1' }],
        quotes: ['No videos yet'],
        promptPlaceholders: ['Describe a video'],
    },
} as unknown as AgentType;

export const apiAgent = {
    ...baseAgent,
    _id: 'api-agent-1',
    name: 'API Agent',
    uiConfig: {
        componentType: 'api',
        type: 'jsonviewer',
        formSpec: [],
    },
} as unknown as AgentType;
