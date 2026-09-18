export type LoginActivityEntryType = {
    readonly _id: string;
    type: 'cookie' | 'jwt';
    provider: string;
    email?: string;
    requestId: string;
    ipAddr: string;
    userAgent: string;
    status: string;
    reason?: string;
    expiresAt?: string | null;
    createdAt: string;
    updatedAt: string;
};

export type LoginActivitySessionType = {
    requestId: string;
    activities: LoginActivityEntryType[];
};
