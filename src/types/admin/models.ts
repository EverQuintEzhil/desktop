import type { SecurityGroupType, UserType } from './users';

/**
 * What to call a model on screen: the label an admin set, falling back to the raw
 * provider model string. Trimmed, so a whitespace-only label does not render blank.
 * Returns '' when neither is set, so callers can chain their own last resort —
 * `modelDisplayName(model) || model._id`.
 */
export const modelDisplayName = (model: { label?: string | null; model?: string | null } | null | undefined): string =>
    model?.label?.trim() || model?.model?.trim() || '';

export type ProviderEnum =
    | 'azure'
    | 'openai'
    | 'together-ai'
    | 'replicate'
    | 'vertex-ai'
    | 'azure-bfl'
    | 'azure-anthropic';
export type ModelType = {
    readonly _id: string;
    provider: ProviderEnum;
    model: string;
    label?: string | null;
    refName: string;
    description: string;
    adminNotes?: string;
    capability: string;
    allows: string[];
    includeUsers: UserType[];
    includeSecurityGroups: SecurityGroupType[];
    excludeUsers: UserType[];
    excludeSecurityGroups: SecurityGroupType[];
    creator: UserType;
    updatedBy: UserType;
    createdAt: string;
    updatedAt: string;
    configuration: object;
    parameters: object;
    co2MultiplierPerToken?: number;
    inputCostPerMillionTokens?: number;
    cachedInputCostPerMillionTokens?: number;
    cacheWriteInputCostPerMillionTokens?: number;
    reasoningCostPerMillionTokens?: number;
    outputCostPerMillionTokens?: number;
};
