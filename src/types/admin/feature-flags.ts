export interface FeatureFlagType {
    readonly _id: string;
    name: string;
    key: string;
    description: string;
    enabled: boolean;
    type: 'boolean' | 'string' | 'number' | 'json';
    value?: string | number | boolean | object;
    createdAt: string;
    updatedAt: string;
    creatorId: string;
    updatedById: string;
}
