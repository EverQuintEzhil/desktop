import { z } from 'zod';

import { apiClient, type ApiRequestConfig } from '../client';

const ARTIFACTS_PATH = '/ai/artifacts';

const CONTENT_LIMIT_BYTES = 131072;

export const artifactTypeSchema = z.enum(['html', 'svg', 'mermaid', 'markdown', 'code']);

export type ArtifactType = z.infer<typeof artifactTypeSchema>;

const authorKindSchema = z.enum(['model', 'user']);

const timestampSchema = z.union([z.string(), z.number()]).transform((value) => String(value));

const optionalTextSchema = z.string().min(1).nullish();

const versionNumberSchema = z.number().int().positive();

export interface ArtifactHead {
    artifactId: string;
    agentId: string;
    conversationId: string;
    slug: string;
    title: string;
    artifactType: ArtifactType;
    language?: string;
    latestVersion: number;
    creatorId: string;
    lastAuthorKind: 'model' | 'user';
    createdAt: string;
    updatedAt: string;
}

export interface ArtifactVersionMeta {
    artifactId: string;
    versionNumber: number;
    title: string;
    artifactType: ArtifactType;
    language?: string;
    contentBytes: number;
    authorKind: 'model' | 'user';
    authorId: string;
    authorName?: string;
    restoredFromVersion?: number;
    createdAt: string;
}

export interface ArtifactVersion extends ArtifactVersionMeta {
    content: string;
}

const rawArtifactHeadSchema = z.object({
    artifact_id: optionalTextSchema,
    agent_id: z.string().min(1),
    conversation_id: z.string().min(1),
    slug: z.string().min(1),
    title: z.string(),
    artifact_type: artifactTypeSchema,
    language: optionalTextSchema,
    latest_version: versionNumberSchema,
    creator_id: z.string().min(1),
    last_author_kind: authorKindSchema,
    created_at: timestampSchema,
    updated_at: timestampSchema,
});

const artifactHeadSchema = rawArtifactHeadSchema.transform((raw): ArtifactHead => ({
    artifactId: raw.artifact_id ?? `${raw.conversation_id}:${raw.slug}`,
    agentId: raw.agent_id,
    conversationId: raw.conversation_id,
    slug: raw.slug,
    title: raw.title,
    artifactType: raw.artifact_type,
    language: raw.language ?? undefined,
    latestVersion: raw.latest_version,
    creatorId: raw.creator_id,
    lastAuthorKind: raw.last_author_kind,
    createdAt: raw.created_at,
    updatedAt: raw.updated_at,
}));

const rawArtifactVersionMetaSchema = z.object({
    artifact_id: z.string().min(1),
    version_number: versionNumberSchema,
    title: z.string(),
    artifact_type: artifactTypeSchema,
    language: optionalTextSchema,
    content_bytes: z.number().int().nonnegative(),
    author_kind: authorKindSchema,
    author_id: z.string().min(1),
    author_name: optionalTextSchema,
    restored_from_version: versionNumberSchema.nullish(),
    created_at: timestampSchema,
});

type RawArtifactVersionMeta = z.infer<typeof rawArtifactVersionMetaSchema>;

const toArtifactVersionMeta = (raw: RawArtifactVersionMeta): ArtifactVersionMeta => ({
    artifactId: raw.artifact_id,
    versionNumber: raw.version_number,
    title: raw.title,
    artifactType: raw.artifact_type,
    language: raw.language ?? undefined,
    contentBytes: raw.content_bytes,
    authorKind: raw.author_kind,
    authorId: raw.author_id,
    authorName: raw.author_name ?? undefined,
    restoredFromVersion: raw.restored_from_version ?? undefined,
    createdAt: raw.created_at,
});

const artifactVersionMetaSchema = rawArtifactVersionMetaSchema.transform(toArtifactVersionMeta);

const artifactVersionSchema = rawArtifactVersionMetaSchema
    .extend({ content: z.string() })
    .transform((raw): ArtifactVersion => ({ ...toArtifactVersionMeta(raw), content: raw.content }));

const artifactListSchema = z.object({
    total: z.number().int().nonnegative(),
    items: z.array(artifactHeadSchema),
});

const savedVersionSchema = z.object({
    artifactId: z.string().min(1),
    versionNumber: versionNumberSchema,
});

export interface ArtifactListParams {
    agentId: string;
    conversationId?: string;
    from?: number;
    size?: number;
}

export interface SaveArtifactVersionBody {
    content: string;
    title?: string;
    expectedVersion?: number;
    restoredFromVersion?: number;
}

const requiredText = (value: string, label: string): string => {
    const text = typeof value === 'string' ? value.trim() : '';

    if (!text) {
        throw new Error(`${label} is required.`);
    }

    return text;
};

const requiredVersionNumber = (value: number): number => {
    if (!Number.isInteger(value) || value < 1) {
        throw new Error('A version number must be a whole number of at least 1.');
    }

    return value;
};

const artifactUrl = (artifactId: string): string =>
    `${ARTIFACTS_PATH}/${encodeURIComponent(requiredText(artifactId, 'An artifact id'))}`;

const validateSaveBody = (body: SaveArtifactVersionBody): SaveArtifactVersionBody => {
    if (typeof body.content !== 'string' || body.content.length === 0) {
        throw new Error('An artifact cannot be saved with empty content.');
    }

    if (new TextEncoder().encode(body.content).length > CONTENT_LIMIT_BYTES) {
        throw new Error('This artifact is larger than the 128 KB limit. Please shorten it before saving.');
    }

    if (body.expectedVersion !== undefined) requiredVersionNumber(body.expectedVersion);
    if (body.restoredFromVersion !== undefined) requiredVersionNumber(body.restoredFromVersion);

    return body;
};

export const appArtifactApi = {
    async listArtifacts(
        params: ArtifactListParams,
        config?: ApiRequestConfig,
    ): Promise<{ total: number; items: ArtifactHead[] }> {
        const query: Record<string, string | number> = { agentId: requiredText(params.agentId, 'An agent id') };

        if (params.conversationId) query.conversationId = params.conversationId;
        if (params.from !== undefined) query.from = params.from;
        if (params.size !== undefined) query.size = params.size;

        const raw = await apiClient.get<unknown>(ARTIFACTS_PATH, { ...config, params: query });

        return artifactListSchema.parse(raw);
    },

    async getArtifact(artifactId: string, agentId: string, config?: ApiRequestConfig): Promise<ArtifactHead> {
        const raw = await apiClient.get<unknown>(artifactUrl(artifactId), {
            ...config,
            params: { agentId: requiredText(agentId, 'An agent id') },
        });

        return artifactHeadSchema.parse(raw);
    },

    async listVersions(artifactId: string, agentId: string, config?: ApiRequestConfig): Promise<ArtifactVersionMeta[]> {
        const raw = await apiClient.get<unknown>(`${artifactUrl(artifactId)}/versions`, {
            ...config,
            params: { agentId: requiredText(agentId, 'An agent id') },
        });

        return z.array(artifactVersionMetaSchema).parse(raw);
    },

    async getVersion(
        artifactId: string,
        agentId: string,
        versionNumber: number,
        config?: ApiRequestConfig,
    ): Promise<ArtifactVersion> {
        const raw = await apiClient.get<unknown>(
            `${artifactUrl(artifactId)}/versions/${requiredVersionNumber(versionNumber)}`,
            { ...config, params: { agentId: requiredText(agentId, 'An agent id') } },
        );

        return artifactVersionSchema.parse(raw);
    },

    async saveVersion(
        artifactId: string,
        agentId: string,
        body: SaveArtifactVersionBody,
        config?: ApiRequestConfig,
    ): Promise<{ artifactId: string; versionNumber: number }> {
        const raw = await apiClient.post<unknown, SaveArtifactVersionBody>(
            `${artifactUrl(artifactId)}/versions`,
            validateSaveBody(body),
            { ...config, params: { agentId: requiredText(agentId, 'An agent id') } },
        );

        return savedVersionSchema.parse(raw);
    },

    async deleteArtifact(artifactId: string, agentId: string, config?: ApiRequestConfig): Promise<void> {
        await apiClient.delete<unknown>(artifactUrl(artifactId), {
            ...config,
            params: { agentId: requiredText(agentId, 'An agent id') },
        });
    },
};
