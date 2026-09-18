import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import type { ArtifactVersion } from './artifact-types';
import { ArtifactView } from './artifact-view';

vi.mock('@/components/markdown', () => ({
    default: ({ children }: { children: string }) => <div data-testid="markdown">{children}</div>,
    CARD_PROSE_CLASS_NAME: 'prose',
}));

vi.mock('@/components/markdown/mermaid-diagram/utils', () => ({
    formatMermaidError: (error: unknown) => String(error),
    loadMermaid: () =>
        Promise.resolve({ initialize: () => {}, render: () => Promise.resolve({ svg: '<svg><g>signup</g></svg>' }) }),
    removeMermaidTemporaryRenderNode: () => {},
    sanitizeMermaidChart: (chart: string) => chart,
}));

const version = (overrides: Partial<ArtifactVersion>): ArtifactVersion => ({
    artifactId: 'conv-1:doc',
    versionNumber: 1,
    title: 'Doc',
    artifactType: 'code',
    contentBytes: 0,
    authorKind: 'model',
    authorId: 'model-1',
    createdAt: '2026-09-09T10:00:00.000Z',
    content: '',
    ...overrides,
});

const renderHtml = (content: string) => {
    const { container } = render(<ArtifactView version={version({ artifactType: 'html', content })} mode="preview" />);

    return container.querySelector('iframe');
};

describe('ArtifactView', () => {
    it("draws a mermaid artifact with the pane's own renderer, carrying no toolbar of its own", async () => {
        render(
            <ArtifactView version={version({ artifactType: 'mermaid', content: 'graph TD; a-->b;' })} mode="preview" />,
        );

        expect(await screen.findByTestId('artifact-mermaid')).toBeInTheDocument();

        // The chat card's chrome must not come with it — the pane header owns these.
        expect(screen.queryByRole('button', { name: /zoom/i })).not.toBeInTheDocument();
        expect(screen.queryByRole('button', { name: /download/i })).not.toBeInTheDocument();
        expect(screen.queryByText('Mermaid')).not.toBeInTheDocument();
    });

    it('shows mermaid source when the pane asks for it, like every other type', () => {
        render(
            <ArtifactView version={version({ artifactType: 'mermaid', content: 'graph TD; a-->b;' })} mode="code" />,
        );

        expect(screen.queryByTestId('artifact-mermaid')).not.toBeInTheDocument();
        expect(screen.getByText('graph TD; a-->b;')).toBeInTheDocument();
    });

    it('leaves copying to the pane header rather than adding a second copy button', () => {
        render(<ArtifactView version={version({ artifactType: 'code', content: 'print(1)' })} mode="code" />);

        expect(screen.queryByRole('button', { name: /copy/i })).not.toBeInTheDocument();
    });

    it('runs an html artifact in an iframe that is denied same-origin access', () => {
        const frame = renderHtml('<p>hi</p>');

        expect(frame).toHaveAttribute('sandbox', 'allow-scripts');
        expect(frame?.getAttribute('sandbox')).not.toContain('allow-same-origin');
    });

    it('styles the frame\u2019s own scrollbar, which the app stylesheet cannot reach', () => {
        const srcDoc = renderHtml('<p>hi</p>')?.getAttribute('srcdoc') ?? '';

        expect(srcDoc).toContain('::-webkit-scrollbar{width:6px;height:6px}');
        expect(srcDoc).toContain('::-webkit-scrollbar-track{background:transparent}');
    });

    it('sizes the preview iframe explicitly, since a replaced element will not stretch on its own', () => {
        const frame = renderHtml('<p>hi</p>');

        expect(frame?.className).toContain('h-full');
        expect(frame?.className).toContain('w-full');
    });

    it('injects a content security policy that blocks the generated page from calling out', () => {
        const srcDoc = renderHtml('<p>hi</p>')?.getAttribute('srcdoc') ?? '';

        expect(srcDoc).toContain('http-equiv="Content-Security-Policy"');
        expect(srcDoc).toContain("default-src 'none'");
        expect(srcDoc).toContain("form-action 'none'");
        expect(srcDoc).toContain("base-uri 'none'");
        expect(srcDoc.endsWith('<p>hi</p>')).toBe(true);
    });

    it('puts the policy ahead of every element so the parser reads it into the head first', () => {
        const srcDoc =
            renderHtml('<!doctype html><html><head><title>t</title></head><body>x</body></html>')?.getAttribute(
                'srcdoc',
            ) ?? '';

        expect(srcDoc.startsWith('<!doctype html><meta http-equiv="Content-Security-Policy"')).toBe(true);
        expect(srcDoc.indexOf('Content-Security-Policy')).toBeLessThan(srcDoc.indexOf('<html>'));
    });

    it('keeps the policy out of the body when the markup contains a header or a late head element', () => {
        const withHeaderElement =
            renderHtml('<!doctype html><html><body><header>Nav</header></body></html>')?.getAttribute('srcdoc') ?? '';
        const withLateHead = renderHtml('<p>hi</p><head></head>')?.getAttribute('srcdoc') ?? '';

        expect(withHeaderElement.indexOf('Content-Security-Policy')).toBeLessThan(
            withHeaderElement.indexOf('<header>'),
        );
        expect(withLateHead.startsWith('<meta http-equiv="Content-Security-Policy"')).toBe(true);
    });

    it('puts the policy after the doctype when the document has no head', () => {
        const srcDoc = renderHtml('<!doctype html><p>hi</p>')?.getAttribute('srcdoc') ?? '';

        expect(srcDoc.startsWith('<!doctype html><meta http-equiv="Content-Security-Policy"')).toBe(true);
    });

    it('strips script and event handlers out of an svg artifact before it is inlined', () => {
        const { container } = render(
            <ArtifactView
                version={version({
                    artifactType: 'svg',
                    content:
                        '<svg xmlns="http://www.w3.org/2000/svg"><script>globalThis.pwned = true;</script><circle r="5" onload="globalThis.pwned = true" /></svg>',
                })}
                mode="preview"
            />,
        );

        expect(container.querySelector('svg')).not.toBeNull();
        expect(container.querySelector('script')).toBeNull();
        expect(container.querySelector('circle')?.hasAttribute('onload')).toBe(false);
    });

    it('shows the source rather than a preview when the card asks for it', () => {
        const { container } = render(
            <ArtifactView version={version({ artifactType: 'html', content: '<p>hi</p>' })} mode="code" />,
        );

        expect(container.querySelector('iframe')).toBeNull();
        expect(container.querySelector('pre code')).toHaveTextContent('<p>hi</p>');
    });

    it('renders a markdown artifact as prose', () => {
        render(<ArtifactView version={version({ artifactType: 'markdown', content: '# Title' })} mode="preview" />);

        expect(screen.getByTestId('markdown')).toHaveTextContent('# Title');
    });

    it('falls back to source for a code artifact', () => {
        const { container } = render(
            <ArtifactView
                version={version({ artifactType: 'code', language: 'python', content: 'print(1)' })}
                mode="preview"
            />,
        );

        expect(container.querySelector('pre code')).toHaveTextContent('print(1)');
    });
});
