import type { ToolType } from './tools';
import type { SecurityGroupType, UserType } from './users';

export type ProviderType =
    | 'api'
    | 'mongodb'
    | 'cassandra'
    | 'opensearch'
    | 'elasticsearch'
    | 'mssql'
    | 'mysql'
    | 'postgresql'
    | 'files'
    | 'azure-blob-storage'
    | 's3'
    | 'sharepoint'
    | 'custom'
    | 'weblinks';

export const PROVIDER_OPTIONS: { value: ProviderType; label: string }[] = [
    { value: 'api', label: 'API' },
    { value: 'mongodb', label: 'MongoDB' },
    { value: 'cassandra', label: 'Cassandra' },
    { value: 'opensearch', label: 'OpenSearch' },
    { value: 'elasticsearch', label: 'Elasticsearch' },
    { value: 'mssql', label: 'Microsoft SQL Server' },
    { value: 'mysql', label: 'MySQL' },
    { value: 'postgresql', label: 'PostgreSQL' },
    { value: 'files', label: 'Files' },
    { value: 'azure-blob-storage', label: 'Azure Blob Storage' },
    { value: 's3', label: 'S3' },
    { value: 'sharepoint', label: 'Sharepoint' },
    { value: 'custom', label: 'Custom' },
    { value: 'weblinks', label: 'Web Links' },
];

export const getProviderLabel = (provider: ProviderType): string =>
    PROVIDER_OPTIONS.find((p) => p.value === provider)?.label ?? 'Data store';

// The api provider returns one entry per OpenAPI operation; others return plain names.
export type DataStoreCollection =
    | string
    | {
          readonly id: string;
          readonly name: string;
          readonly type?: string;
          readonly path?: string;
      };

export type DataStoreType = {
    readonly _id: string;
    name: string;
    provider: ProviderType;
    refName: string;
    description: string;
    connection: object;
    specification: string;
    showInAgentBuilder?: boolean;
    embeddingConfig: {
        embeddingFields: string[];
        metadataFields: string[];
        cron: string;
    };
    tools: ToolType[];
    includeUsers: UserType[];
    includeSecurityGroups: SecurityGroupType[];
    excludeUsers: UserType[];
    excludeSecurityGroups: SecurityGroupType[];
    creatorId: UserType;
    updatedById: UserType;
    creator: UserType;
    updatedBy: UserType;
    createdAt: string;
    updatedAt: string;
    okf?: { version: string; files: { path: string; content: string }[] } | null;
    okfStatus?: 'pending' | 'generating' | 'completed' | 'failed' | null;
    okfError?: string | null;
    okfGeneratedAt?: string | null;
    noAccess?: boolean;
};
