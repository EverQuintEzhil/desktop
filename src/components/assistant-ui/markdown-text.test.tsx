import { render } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';

const primitiveProps: Record<string, unknown>[] = [];

let running = false;

vi.mock('@assistant-ui/react', () => ({
    useAuiState: () => running,
}));

vi.mock('@assistant-ui/react-markdown', () => ({
    MarkdownTextPrimitive: (props: Record<string, unknown>) => {
        primitiveProps.push(props);

        return null;
    },
    escapeCurrencyDollars: (text: string) => text,
    normalizeMathDelimiters: (text: string) => text,
    unstable_memoizeMarkdownComponents: (components: unknown) => components,
    useIsMarkdownCodeBlock: () => false,
}));

const { MarkdownText } = await import('./markdown-text');

const GLUED = '$$\nx = 1.$$\n';
const REPAIRED = '$$\nx = 1.\n$$\n';

const preprocessOf = (index = 0) => primitiveProps[index].preprocess as (text: string) => string;

describe('MarkdownText', () => {
    beforeEach(() => {
        primitiveProps.length = 0;
        running = false;
    });

    it('turns the reveal off by default so a settled repair cannot freeze the message', () => {
        render(<MarkdownText />);

        expect(primitiveProps).toHaveLength(1);
        expect(primitiveProps[0].smooth).toBe(false);
    });

    it('lets a caller opt back into the reveal explicitly', () => {
        render(<MarkdownText smooth={true} />);

        expect(primitiveProps[0].smooth).toBe(true);
    });

    it('defers parsing so a streamed delta cannot block typing', () => {
        render(<MarkdownText />);

        expect(primitiveProps[0].defer).toBe(true);
    });

    it('repairs a glued fence mid stream while the reveal is off', () => {
        running = true;
        render(<MarkdownText />);

        expect(preprocessOf()(GLUED)).toBe(REPAIRED);
    });

    /**
     * `preprocess` runs upstream of `useSmooth`, which restarts its reveal whenever the new text no
     * longer begins with the text it already displayed, so a mid-stream repair with the reveal on
     * re-types the whole message. Re-enabling `smooth` must therefore put the deferral back.
     */
    it('defers the repair to settle whenever the reveal is on', () => {
        running = true;
        render(<MarkdownText smooth={true} />);

        expect(preprocessOf()(GLUED)).toBe(GLUED);
    });

    it('still repairs once the part settles even with the reveal on', () => {
        running = false;
        render(<MarkdownText smooth={true} />);

        expect(preprocessOf()(GLUED)).toBe(REPAIRED);
    });
});
