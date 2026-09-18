import type { BlogPostCategoryType, BlogPostType } from '@/types/admin';

/**
 * The collection a post is filed under. `categoryId` is the only thing that files it; `tags` are
 * free-form labels and never imply a collection.
 *
 * Announcements are never filed: collections belong to the help centre, and an announcement that
 * happens to carry a category must not pick up a breadcrumb, a sidebar or a Previous/Next from it.
 */
export const resolveCategoryTag = (post: BlogPostType | undefined): BlogPostCategoryType | undefined => {
    if (post?.type === 'announcement') {
        return undefined;
    }

    return post?.category ?? undefined;
};
