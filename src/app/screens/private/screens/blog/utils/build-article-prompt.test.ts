import { describe, expect, it } from 'vitest';

import { buildArticlePrompt } from './build-article-prompt';

describe('buildArticlePrompt', () => {
    it('includes the article title and its absolute help-center URL', () => {
        const prompt = buildArticlePrompt('Managing spaces', 'managing-spaces');

        expect(prompt).toContain('Managing spaces');
        expect(prompt).toContain(`${window.location.origin}/help-center/managing-spaces`);
    });
});
