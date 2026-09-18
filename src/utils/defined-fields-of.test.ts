import { describe, expect, it } from 'vitest';

import definedFieldsOf from './defined-fields-of';

describe('definedFieldsOf', () => {
    it('drops undefined fields so a partial payload cannot erase a fuller one', () => {
        const cached = { _id: 'file-1', agentSlug: 'test-agent', agentName: 'Test Agent' };
        const refetched = { _id: 'file-1', agentSlug: undefined, agentName: undefined };

        expect({ ...cached, ...definedFieldsOf(refetched) }).toEqual(cached);
    });

    it('keeps null, which is an answer rather than a gap', () => {
        expect(definedFieldsOf({ conversationId: null, originType: undefined })).toEqual({ conversationId: null });
    });

    it('keeps falsy values that are not undefined', () => {
        expect(
            definedFieldsOf({
                likesCount: 0,
                isPublic: false,
                title: '',
                missing: undefined,
            }),
        ).toEqual({ likesCount: 0, isPublic: false, title: '' });
    });
});
