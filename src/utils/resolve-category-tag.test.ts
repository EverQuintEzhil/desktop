import { describe, expect, it } from 'vitest';

import type { BlogPostType } from '@/types/admin';

import { resolveCategoryTag } from './resolve-category-tag';

const gettingStarted = { _id: 'tag-1', name: 'Getting Started', icon: 'rocket' };
const billing = { _id: 'tag-2', name: 'Billing' };

const buildPost = (overrides: Partial<BlogPostType>) =>
    ({ type: 'post', tags: [billing], categoryId: null, category: null, ...overrides }) as unknown as BlogPostType;

describe('resolveCategoryTag', () => {
    it('uses the post category', () => {
        const post = buildPost({ categoryId: 'tag-1', category: gettingStarted } as Partial<BlogPostType>);

        expect(resolveCategoryTag(post)?._id).toBe('tag-1');
    });

    it('never falls back to a tag', () => {
        expect(resolveCategoryTag(buildPost({ tags: [billing] } as Partial<BlogPostType>))).toBeUndefined();
    });

    it('gives an announcement no category even when it carries one', () => {
        const announcement = buildPost({
            type: 'announcement',
            categoryId: 'tag-1',
            category: gettingStarted,
        } as Partial<BlogPostType>);

        expect(resolveCategoryTag(announcement)).toBeUndefined();
    });

    it('returns nothing for an unfiled post', () => {
        expect(resolveCategoryTag(buildPost({}))).toBeUndefined();
        expect(resolveCategoryTag(undefined)).toBeUndefined();
    });

    // Every /blogposts response embeds `category` whenever `categoryId` is set, so this shape does
    // not occur today. Dropping the crumb beats rendering a nameless one, and locking it here makes
    // an id-only fallback a deliberate change rather than a silent one.
    it('gives no category when the embed is missing, even with an id', () => {
        const post = buildPost({ categoryId: 'tag-1', category: null } as Partial<BlogPostType>);

        expect(resolveCategoryTag(post)).toBeUndefined();
    });
});
