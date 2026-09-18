import type { UserType } from '@/types/admin';

export interface DataStoreItem {
    _id: string;
    name: string;
    description?: string;
    provider?: string;
    creator?: UserType;
}

export type ActivePanel = null | 'add-ds' | string;
