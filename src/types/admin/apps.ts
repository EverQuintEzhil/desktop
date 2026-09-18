import type { AgentType } from './agents';
import type { SecurityGroupType, UserType } from './users';

export interface AppManifestType {
    name?: string;
    description?: string;
    version?: string;
    connect?: string[];
    capabilities?: string[];
    input_schema?: Record<string, unknown>;
    [key: string]: unknown;
}

export interface AppVersionType {
    _id: string;
    appId: string;
    version: string;
    bundleUrl: string;
    manifest: AppManifestType;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
}

/**
 * A GenUI app linked to an agent (spec §3/§11). `refName` is the stable slug
 * used as the AI SDK tool name and in the bundle path; `bundleUrl` + `version`
 * point at the immutable published ESM bundle on the assets host.
 */
export type AppType = {
    readonly _id: string;
    refName: string;
    name: string;
    description: string;
    latestVersion: string;
    /** Resolved latest-version bundle, present on the launcher/chat agent serializer (mapAgentApps). */
    version?: string;
    bundleUrl?: string;
    inputSchema?: {
        type: string;
        required: string[];
        properties: Record<string, { type: string; description: string }>;
    };
    connect: string[];
    capabilities: string[];
    mcpExposable: boolean;
    // Interactive (client-resolved) app: the model pauses until the user submits
    // (e.g. a form) and the client resumes with the tool result.
    interactive?: boolean;
    display?: { framed?: boolean; maxWidth?: string };
    agents: AgentType[];
    admins: UserType[] | string[];
    includeUsers: UserType[];
    includeSecurityGroups: SecurityGroupType[];
    excludeUsers: UserType[];
    excludeSecurityGroups: SecurityGroupType[];
    versions?: AppVersionType[];
    status: string;
    isDeleted: boolean;
    creator: UserType;
    updatedBy: UserType;
    createdAt: string;
    updatedAt: string;
};
