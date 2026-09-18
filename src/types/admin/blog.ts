import type { FileType } from './files';
import type { LauncherAgentType } from './launchers';
import type { UserType } from './users';

export type BlogPostTypeEnum = 'post' | 'page' | 'announcement';

export type BlogPostContentTypeEnum = 'text' | 'html' | 'markdown';

export type BlogPostTagType = {
    readonly _id: string;
    name: string;
};

export type BlogPostCategoryType = {
    readonly _id: string;
    name: string;
    icon: string;
};

export type BlogPostRelatedType = {
    readonly _id: string;
    title: string;
    slug: string;
};

export type BlogPostType = {
    readonly _id: string;
    title: string;
    slug: string;
    type: BlogPostTypeEnum;
    contentType: BlogPostContentTypeEnum;
    agentId: LauncherAgentType;
    description: string;
    content: string;
    featuredImage: string | FileType;
    sortOrder: number;
    tags: BlogPostTagType[];
    categoryId: string | null;
    category: BlogPostCategoryType | null;
    categorySortOrder: number | null;
    relatedPostIds: BlogPostRelatedType[];
    isPublished: boolean;
    isPublic: boolean;
    isFeatured: boolean;
    creator: UserType;
    updatedBy: UserType;
    createdAt: string;
    updatedAt: string;
};
