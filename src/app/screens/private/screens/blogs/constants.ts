export const ANNOUNCEMENTS_PATH = '/announcements';
export const HELP_CENTER_PATH = '/help-center';
export const HELP_CENTER_COLLECTIONS_PATH = `${HELP_CENTER_PATH}/collections`;

export const BLOG_FILTER_TRIGGER_CLASS = 'h-10 border border-border-secondary bg-card px-4 font-medium';
export const BLOG_FILTER_ITEM_CLASS = 'justify-between gap-4 [&>span]:flex-1';

export const BLOG_SORT_NEWEST = 'updatedAt:desc';
export const BLOG_SORT_OLDEST = 'updatedAt:asc';
export const BLOG_SORT_ARTICLE_ORDER = 'categorySortOrder:asc';

export type BlogSortOption = {
    value: string;
    label: string;
};

export const FEED_SORT_OPTIONS: BlogSortOption[] = [
    { value: BLOG_SORT_NEWEST, label: 'Newest first' },
    { value: BLOG_SORT_OLDEST, label: 'Oldest first' },
];

export const COLLECTION_SORT_OPTIONS: BlogSortOption[] = [
    { value: BLOG_SORT_ARTICLE_ORDER, label: 'Article order' },
    { value: BLOG_SORT_NEWEST, label: 'Newest first' },
    { value: BLOG_SORT_OLDEST, label: 'Oldest first' },
];

export const CATEGORY_SORT_DEFAULT = 'sortOrder:asc';
export const BLOG_SORT_NAME = 'name:asc';

export const CATEGORY_SORT_OPTIONS: BlogSortOption[] = [
    { value: CATEGORY_SORT_DEFAULT, label: 'Default order' },
    { value: BLOG_SORT_NAME, label: 'Name (A–Z)' },
    { value: BLOG_SORT_NEWEST, label: 'Newest first' },
    { value: BLOG_SORT_OLDEST, label: 'Oldest first' },
];

/**
 * The two screens share the `sort` query param but accept disjoint values, so a link carrying the
 * other screen's sort — or a hand-edited one — must fall back rather than reach the API.
 */
export const resolveSort = (value: string | null, options: BlogSortOption[], fallback: string): string =>
    options.some((option) => option.value === value) ? (value as string) : fallback;
