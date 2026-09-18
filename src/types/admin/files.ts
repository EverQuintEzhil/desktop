import type { UserType } from './users';

export type FileType = {
    name: string;
    type?: string;
    url: string;
    location?: string;
    _id?: string;
    thumb?: string;
    tempId?: string;
    size?: number;
    groupName?: string | undefined;
    isUploading?: boolean;
    uploadProgress?: number;
    uploadError?: boolean;
};

export type SkillFileType = {
    skillId: string;
    path: string;
    kind: string;
    fileId: string;
    mimeType: string;
    sizeBytes: number;
    sha256: string | null;
    metadata: object;
    updatedById: string;
    creatorId: string;
    isDeleted: boolean;
    createdAt: string;
    updatedAt: string;
};

export type AssetType = {
    readonly _id: string;
    key: string;
    url: string;
    bucketName: string;
    cloudProvider: string;
    isDeleted: boolean;
    creator: UserType;
    updatedBy: UserType;
    createdAt: string;
    updatedAt: string;
};
