import type { UserType } from './users';

// GET /tags defaults tagFor to 'catalog', so categories must be asked for explicitly.
export type TagForEnum = 'catalog' | 'folder' | 'blogpost';

export const BLOG_TAG_FOR: TagForEnum = 'blogpost';

export const TAG_FOR_OPTIONS: ReadonlyArray<{ value: TagForEnum; label: string }> = [
    { value: 'catalog', label: 'Catalog' },
    { value: 'folder', label: 'Folder' },
    { value: 'blogpost', label: 'Blog category' },
];

export function tagForLabel(tagFor: TagForEnum | undefined): string {
    return TAG_FOR_OPTIONS.find((option) => option.value === tagFor)?.label ?? '-';
}

export type TagType = {
    readonly _id: string;
    name: string;
    icon: string;
    value?: string;
    description: string;
    featured: boolean;
    sortOrder: number;
    tagFor: TagForEnum;
    // Attached only to a tagFor=blogpost list; never to GET /tags/:tagId.
    postCount?: number;
    creatorId: UserType;
    updatedById: UserType;
    creator: UserType;
    updatedBy: UserType;
    createdAt: string;
    updatedAt: string;
};
