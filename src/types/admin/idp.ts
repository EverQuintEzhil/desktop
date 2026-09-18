import type { UserType } from './users';

export type RequestConfigType = {
    authorizationUrl: string;
    clientId: string;
    responseType: string;
    redirectUri: string;
    scope: string;
    isCodeChallengeEnabled: boolean;
};

export type MethodType = 'GET' | 'PUT' | 'POST';

export type ValidationConfigType = {
    name: string;
    method: MethodType;
    url: string;
    headers: object;
    data: object;
    params: object;
    value: string;
    order: number;
};

export type IDPType = {
    readonly _id: string;
    name: string;
    avatar: string;
    allowUserCreation: boolean;
    isEnabled: boolean;
    isLoginHidden: boolean;
    sortOrder: 0;
    requestConfig: RequestConfigType;
    secrets: string[];
    validationConfigs: ValidationConfigType[];
    creatorId: UserType;
    updatedById: UserType;
    creator: UserType;
    updatedBy: UserType;
    createdAt: string;
    updatedAt: string;
    ui?: unknown;
};
