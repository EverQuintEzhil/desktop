import type { DataStoreType } from '@/types/admin';

const baseDataStore = {
    _id: 'ds-1',
    name: 'To Do Data Store',
    provider: 'mongodb',
    refName: 'to-do-data-store',
    description: 'Task-tracking collection with per-user todos.',
    connection: {},
    specification: '',
    embeddingConfig: { embeddingFields: [], metadataFields: [], cron: '' },
    tools: [],
    includeUsers: [],
    includeSecurityGroups: [],
    excludeUsers: [],
    excludeSecurityGroups: [],
    creatorId: { _id: 'user-1' },
    updatedById: { _id: 'user-1' },
    creator: { _id: 'user-1', name: { first: 'Test', last: 'User' } },
    updatedBy: { _id: 'user-1', name: { first: 'Test', last: 'User' } },
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    okf: null,
    okfStatus: null,
    okfError: null,
    okfGeneratedAt: null,
};

/** Minimal-but-typed DataStoreType fixture, following the agents.ts `as unknown as` fixture pattern. */
export const buildDataStore = (overrides: Partial<DataStoreType> = {}): DataStoreType =>
    ({
        ...baseDataStore,
        ...overrides,
    }) as unknown as DataStoreType;
