import { adminAgentsApi } from '@/lib/api/admin/agents';
import { adminCodeManagerApi } from '@/lib/api/admin/code-manager';
import { adminModelsApi } from '@/lib/api/admin/models';
import { appAgentsApi } from '@/lib/api/app/agents';
import { modelDisplayName, type AgentType, type CodeType, type LauncherType } from '@/types/admin';
import type { ChatAgentUiType, ModelValueType } from '@/types/ui';

import type { AgentConfigDraft, AgentConfigItem } from '../types';

const DEFAULT_AGENT_NAME = 'Untitled agent';

export const SYSTEM_PROMPT_TYPE = 'agent_system_prompt';
export const UI_CONFIG_TYPE = 'agent_ui_config';

const DEFAULT_HOME_TITLE = 'Your agent';

export const buildDefaultUiConfig = (name?: string): ChatAgentUiType => ({
    componentType: 'chat',
    type: 'chat',
    models: [],
    home: {
        title: name?.trim() || DEFAULT_HOME_TITLE,
        startPage: 'chat',
        search: {
            placeholder: 'Ask anything…',
            files: true,
            showWebSearch: false,
            isWebSearchEnabled: false,
            showDeepSearch: false,
            isDeepSearchEnabled: false,
            isRelatedQuestionsEnabled: false,
            isIncognitoEnabled: false,
        },
        questions: [],
    },
    promptLibrary: { enabled: false, filters: { aimodelIds: [] } },
    spaces: { enabled: false },
});

export const INITIAL_VERSION = '1.0.0';

export const bumpVersion = (version?: string): string => {
    const match = /^(\d+)\.(\d+)\.(\d+)$/.exec(version ?? '');

    if (!match) {
        return '1.0.1';
    }

    const [, major, minor, patch] = match;

    return `${major}.${minor}.${Number(patch) + 1}`;
};

export interface SeededUiConfig {
    uiConfigCodeId: string;
    uiConfigVersion: string;
    uiConfig: ChatAgentUiType;
}

const seedDefaultUiConfig = async (agentId: string, name?: string): Promise<SeededUiConfig> => {
    const uiConfig = buildDefaultUiConfig(name);
    const created = await adminCodeManagerApi.createCode({
        code: JSON.stringify(uiConfig),
        type: UI_CONFIG_TYPE,
        lang: 'json',
        version: INITIAL_VERSION,
        agentId,
    });

    await adminCodeManagerApi.updateEntity('agents', agentId, { uiConfigCodeId: created._id });

    return {
        uiConfigCodeId: created._id,
        uiConfigVersion: created.version ?? INITIAL_VERSION,
        uiConfig,
    };
};

export const slugify = (name: string): string => {
    const base = name
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '');

    return base || 'agent';
};

const randomSuffix = (): string => {
    const ts = Date.now().toString(36).slice(-4);
    const rand = Math.floor(Math.random() * 36 ** 4).toString(36);

    return `${ts}${rand}`;
};

export const uniqueSlug = (name: string): string => `${slugify(name)}-${randomSuffix()}`;

export const uniqueIdentifier = (name: string): string => `com.fluentmind.${slugify(name)}-${randomSuffix()}`;

const isDuplicateKeyError = (error: unknown): boolean => {
    const axiosMessage = (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? '';
    const errorMessage = error instanceof Error ? error.message : '';
    const combined = `${errorMessage} ${axiosMessage}`.toLowerCase();

    return (
        combined.includes('e11000') &&
        combined.includes('duplicate') &&
        (combined.includes('identifier') || combined.includes('slug'))
    );
};

export interface CreateDraftAgentOptions {
    defaultModelId?: string;
    modelIds?: string[];
}

export const createDraftAgent = async (name?: string, options?: CreateDraftAgentOptions): Promise<AgentType> => {
    const resolvedName = name?.trim() || DEFAULT_AGENT_NAME;

    const build = () => ({
        name: resolvedName,
        identifier: uniqueIdentifier(resolvedName),
        slug: uniqueSlug(resolvedName),
        type: 'chat' as const,
        version: 'v2' as const,
        dev: true,
        ...(options?.defaultModelId && { defaultModelId: options.defaultModelId }),
        ...(options?.modelIds?.length && { modelIds: options.modelIds }),
    });

    const createOnce = async (): Promise<AgentType> => {
        try {
            return await adminAgentsApi.create(build());
        } catch (error: unknown) {
            if (isDuplicateKeyError(error)) {
                return adminAgentsApi.create(build());
            }

            throw error;
        }
    };

    const agent = await createOnce();

    try {
        await seedDefaultUiConfig(agent._id, resolvedName);
    } catch {
        return agent;
    }

    return agent;
};

const toNamedItems = (items?: { _id: string; name: string }[]): { _id: string; name: string }[] =>
    (items ?? []).map((item) => ({ _id: item._id, name: item.name }));

const pickCode = (codes: CodeType[], linkedId: string | undefined, type: string): CodeType | undefined => {
    const linked = linkedId ? codes.find((code) => code._id === linkedId) : undefined;

    return linked ?? codes.find((code) => code.type === type);
};

const parseUiConfig = (raw: string | undefined, name?: string): ChatAgentUiType => {
    if (!raw) {
        return buildDefaultUiConfig(name);
    }

    try {
        const parsed = JSON.parse(raw) as ChatAgentUiType;

        return parsed && typeof parsed === 'object' ? parsed : buildDefaultUiConfig(name);
    } catch {
        return buildDefaultUiConfig(name);
    }
};

interface LoadedCodes {
    instructions: string;
    publishedInstructions: string;
    systemPromptCodeId?: string;
    systemPromptVersion?: string;
    pendingCodeId?: string;
    pendingVersion?: string;
    uiConfig?: ChatAgentUiType;
    uiConfigCodeId?: string;
    uiConfigVersion?: string;
    pendingUiConfig?: ChatAgentUiType;
    pendingUiConfigCodeId?: string;
    pendingUiConfigVersion?: string;
}

const newestByCreatedAt = (codes: CodeType[], type: string): CodeType | undefined =>
    codes
        .filter((code) => code.type === type)
        .reduce<CodeType | undefined>((newest, code) => {
            if (!newest || code.createdAt > newest.createdAt) {
                return code;
            }

            return newest;
        }, undefined);

const loadCodes = async (agent: AgentType): Promise<LoadedCodes> => {
    const hasSystemPrompt = !!agent.systemPromptCodeId;

    const list = await adminCodeManagerApi.listCodes({ agentId: agent._id, sortBy: 'createdAt:desc' });
    const codes = list.values;

    const prompt = pickCode(codes, agent.systemPromptCodeId, SYSTEM_PROMPT_TYPE);
    const ui = pickCode(codes, agent.uiConfigCodeId, UI_CONFIG_TYPE);

    const publishedId = prompt?._id;
    const newestPrompt = newestByCreatedAt(codes, SYSTEM_PROMPT_TYPE);
    const draftCode = publishedId && newestPrompt && newestPrompt._id !== publishedId ? newestPrompt : undefined;

    const newestUi = newestByCreatedAt(codes, UI_CONFIG_TYPE);
    const uiDraft = agent.uiConfigCodeId && newestUi && newestUi._id !== agent.uiConfigCodeId ? newestUi : undefined;

    return {
        instructions: draftCode?.code ?? prompt?.code ?? '',
        publishedInstructions: prompt?.code ?? '',
        systemPromptCodeId: prompt?._id ?? (hasSystemPrompt ? agent.systemPromptCodeId : undefined),
        systemPromptVersion: prompt?.version,
        pendingCodeId: draftCode?._id,
        pendingVersion: draftCode?.version,
        uiConfig: ui ? parseUiConfig(ui.code, agent.name) : undefined,
        uiConfigCodeId: ui?._id,
        uiConfigVersion: ui?.version,
        pendingUiConfig: uiDraft ? parseUiConfig(uiDraft.code, agent.name) : undefined,
        pendingUiConfigCodeId: uiDraft?._id,
        pendingUiConfigVersion: uiDraft?.version,
    };
};

export interface LoadedAgentConfig {
    draft: AgentConfigDraft;
    systemPromptCodeId?: string;
    systemPromptVersion?: string;
    publishedInstructions: string;
    pendingCodeId?: string;
    pendingVersion?: string;
    uiConfigCodeId?: string;
    uiConfigVersion?: string;
    uiConfig?: ChatAgentUiType;
    pendingUiConfigCodeId?: string;
    pendingUiConfigVersion?: string;
    pendingUiConfig?: ChatAgentUiType;
    description?: string;
    createdAt?: string;
    updatedAt?: string;
}

export const loadAgentConfig = async (agentId: string): Promise<LoadedAgentConfig> => {
    const agent = await adminAgentsApi.getBySlugOrId(agentId);
    const {
        instructions,
        publishedInstructions,
        systemPromptCodeId,
        systemPromptVersion,
        pendingCodeId,
        pendingVersion,
        uiConfig: loadedUiConfig,
        uiConfigCodeId: loadedUiConfigCodeId,
        uiConfigVersion: loadedUiConfigVersion,
        pendingUiConfig,
        pendingUiConfigCodeId,
        pendingUiConfigVersion,
    } = await loadCodes(agent);

    let uiConfig = loadedUiConfig;
    let uiConfigCodeId = loadedUiConfigCodeId;
    let uiConfigVersion = loadedUiConfigVersion;

    if (!uiConfigCodeId) {
        try {
            const seeded = await seedDefaultUiConfig(agent._id, agent.name);

            uiConfig = seeded.uiConfig;
            uiConfigCodeId = seeded.uiConfigCodeId;
            uiConfigVersion = seeded.uiConfigVersion;
        } catch {
            uiConfig = uiConfig ?? buildDefaultUiConfig(agent.name);
        }
    } else if (!agent.uiConfigCodeId) {
        await adminCodeManagerApi.updateEntity('agents', agent._id, { uiConfigCodeId }).catch(() => {});
    }

    const seededIds = orderDefaultFirst(agentModelIds(agent), agent.defaultModelId);
    const seededModels = seededIds.length ? await resolveModelValues(seededIds) : [];

    if (uiConfig && !uiConfig.models?.length && seededModels.length) {
        uiConfig = applyModelsToUiConfig(uiConfig, seededModels);
    }

    // Backfill the pending draft too: publishing promotes the pending config verbatim, so a pending
    // draft missing its models would otherwise clear the agent's model capabilities on publish.
    let pending = pendingUiConfig;

    if (pending && !pending.models?.length && uiConfig?.models?.length) {
        pending = applyModelsToUiConfig(pending, uiConfig.models);
    }

    const defaultModelId = (pending ?? uiConfig)?.defaultModel?.modelId ?? agent.defaultModelId;
    const modelItems = await resolveModelItems(pending ?? uiConfig, agent, defaultModelId);

    const draft: AgentConfigDraft = {
        name: agent.name ?? '',
        instructions,
        models: orderModelItemsDefaultFirst(modelItems, defaultModelId),
        mcpServers: (agent.mcpServers ?? []).map((mcp) => ({
            _id: mcp._id,
            name: mcp.name,
            ...(mcp.isRecommended !== undefined && { isRecommended: mcp.isRecommended }),
        })),
        agents: toNamedItems(agent.agents),
        tools: toNamedItems(agent.tools),
        files: (agent.dataStores ?? []).map((ds) => ({ _id: ds._id, name: ds.name, provider: ds.provider })),
        skills: (agent.skills ?? []).map((skill) => ({
            _id: skill._id,
            name: skill.name,
            ...(skill.isRecommended !== undefined && { isRecommended: skill.isRecommended }),
        })),
        memories: toNamedItems(agent.memories),
    };

    return {
        draft,
        systemPromptCodeId,
        systemPromptVersion,
        publishedInstructions,
        pendingCodeId,
        pendingVersion,
        uiConfig,
        uiConfigCodeId,
        uiConfigVersion,
        pendingUiConfig: pending,
        pendingUiConfigCodeId,
        pendingUiConfigVersion,
        description: agent.description ?? '',
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
    };
};

export const saveName = async (agentId: string, name: string): Promise<void> => {
    const resolvedName = name.trim() || DEFAULT_AGENT_NAME;

    try {
        await adminAgentsApi.update(agentId, { name: resolvedName, slug: slugify(resolvedName) });
    } catch (error: unknown) {
        if (isDuplicateKeyError(error)) {
            await adminAgentsApi.update(agentId, { name: resolvedName, slug: uniqueSlug(resolvedName) });

            return;
        }

        throw error;
    }
};

export interface CapabilityIds {
    mcpServers?: { mcpServerId: string; isRecommended: boolean }[];
    agentIds?: string[];
    toolIds?: string[];
    dataStoreIds?: string[];
    skills?: { skillId: string; isRecommended: boolean }[];
    memoryIds?: string[];
    defaultModelId?: string | null;
    modelIds?: string[];
}

export const saveCapabilities = async (agentId: string, ids: CapabilityIds): Promise<void> => {
    await adminAgentsApi.update(agentId, ids as Record<string, unknown>);
};

export const applyModelsToUiConfig = (uiConfig: ChatAgentUiType, models: ModelValueType[]): ChatAgentUiType => {
    const next: ChatAgentUiType = { ...uiConfig, models };

    if (models[0]) {
        next.defaultModel = models[0];
    } else {
        delete next.defaultModel;
    }

    return next;
};

export const resolveModelName = async (modelId: string): Promise<string> => {
    try {
        const model = await adminModelsApi.getById(modelId);

        return model.model || modelId;
    } catch {
        return modelId;
    }
};

const resolveModelValues = async (modelIds: string[]): Promise<ModelValueType[]> =>
    Promise.all(modelIds.map(async (modelId) => ({ name: await resolveModelName(modelId), modelId })));

const agentModelIds = (agent: AgentType): string[] =>
    agent.models?.map((model) => model._id) ?? (agent.defaultModelId ? [agent.defaultModelId] : []);

export const orderDefaultFirst = (modelIds: string[], defaultModelId?: string): string[] => {
    if (!defaultModelId || !modelIds.includes(defaultModelId)) {
        return modelIds;
    }

    return [defaultModelId, ...modelIds.filter((id) => id !== defaultModelId)];
};

const orderModelItemsDefaultFirst = (items: AgentConfigItem[], defaultModelId?: string): AgentConfigItem[] => {
    const defaultItem = defaultModelId ? items.find((item) => item._id === defaultModelId) : undefined;

    if (!defaultItem) {
        return items;
    }

    return [defaultItem, ...items.filter((item) => item._id !== defaultModelId)];
};

const resolveModelItems = async (
    uiConfig: ChatAgentUiType | undefined,
    agent: AgentType,
    defaultModelId?: string,
): Promise<AgentConfigItem[]> => {
    if (agent.models?.length) {
        return agent.models.map((model) => ({
            _id: model._id,
            name: modelDisplayName(model) || model._id,
            provider: model.provider,
        }));
    }

    const fromUiConfig = uiConfig?.models;

    if (fromUiConfig?.length) {
        return fromUiConfig.map((model) => ({ _id: model.modelId, name: model.name }));
    }

    if (defaultModelId) {
        return [{ _id: defaultModelId, name: await resolveModelName(defaultModelId) }];
    }

    return [];
};

export const saveDescription = async (agentId: string, description: string): Promise<void> => {
    await adminAgentsApi.update(agentId, { description });
};

/** The one place an owned agent becomes a launcher tile; the agents home renders both id spaces through `LauncherType`. */
export const mapAgentToLauncher = (agent: AgentType): LauncherType =>
    ({
        _id: agent._id,
        name: agent.name,
        urlOrSlug: agent.slug || agent._id,
        description: agent.description || agent.detailedDescription || '',
        detailedDescription: agent.detailedDescription || '',
        type: 'agent',
        createdAt: agent.createdAt,
        updatedAt: agent.updatedAt,
        lastInteractedAt: agent.lastInteractedAt ?? null,
    }) as LauncherType;

export const listMyAgents = async (_userId: string, page = 0, search?: string, sortBy?: string) => {
    const result = await appAgentsApi.listAgents<AgentType>({
        size: 20,
        page,
        mineOnly: true,
        search: search || undefined,
        sortBy: sortBy || undefined,
    });

    return {
        ...result,
        values: result.values.map(mapAgentToLauncher),
    };
};
