import { describe, expect, it } from 'vitest';

import { capabilityListDisplayLabel } from './resources';

const relatedPost = { _id: 'post-1', title: 'Getting started', slug: 'getting-started' };

describe('capabilityListDisplayLabel for blogposts', () => {
    it('reads the post title, since a post has no name', () => {
        expect(capabilityListDisplayLabel(relatedPost, 'blogposts')).toBe('Getting started');
    });

    it('returns an empty label rather than falling through to name', () => {
        expect(capabilityListDisplayLabel({ _id: 'x', name: 'Not a post' }, 'blogposts')).toBe('');
    });

    it('still reads name for every other capability type', () => {
        expect(capabilityListDisplayLabel({ _id: 'tag-1', name: 'Billing' }, 'tags')).toBe('Billing');
    });

    it('returns an empty label for a bare id instead of throwing on the `in` operator', () => {
        const bareId = '6a8c1cc1b5401a2f83605d0c' as unknown as { _id: string; name: string };

        expect(capabilityListDisplayLabel(bareId, 'tags')).toBe('');
        expect(capabilityListDisplayLabel(bareId, 'blogposts')).toBe('');
    });
});
