'use client';

import 'katex/dist/katex.min.css';
import '@/components/markdown/katex-protect.css';
import '@/components/markdown/markdown.scss';
import { type TextMessagePartComponent, useAuiState } from '@assistant-ui/react';
import {
    type CodeHeaderProps,
    escapeCurrencyDollars,
    MarkdownTextPrimitive,
    normalizeMathDelimiters,
    type SyntaxHighlighterProps,
    unstable_memoizeMarkdownComponents as memoizeMarkdownComponents,
    useIsMarkdownCodeBlock,
} from '@assistant-ui/react-markdown';
import { Code2Icon } from 'lucide-react';
import { type ComponentProps, type FC, memo, useCallback } from 'react';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import { CitationChip } from '@/components/assistant-ui/citation-chip';
import { CITATION_HREF_SUFFIX } from '@/components/assistant-ui/citation-sources-context';
import CopyButton from '@/components/copy-button/copy-button';
import LightboxImage, { InsideLinkContext } from '@/components/lightbox-image';
import {
    hideIncompleteMath,
    HtmlSvgPreview,
    KATEX_OPTIONS,
    MermaidDiagram,
    normalizeMathFences,
    rehypeKatexFallback,
} from '@/components/markdown';
import { MarkdownTable } from '@/components/markdown/markdown';
import { cn } from '@/lib/utils';

type MarkdownTextProps = Partial<ComponentProps<TextMessagePartComponent>> & {
    preprocess?: (text: string) => string;
    smooth?: boolean;
};

/** The primitive defaults `smooth` to true, and `useSmooth` freezes its reveal forever when settled text changes behind the displayed prefix. */
const MarkdownTextImpl = ({ preprocess, smooth = false }: MarkdownTextProps) => {
    const isStreaming = useAuiState((state) => state.optional.part?.status.type === 'running');
    const preprocessWithMath = useCallback(
        (text: string) => {
            const source = preprocess ? preprocess(text) : text;
            const shown = isStreaming ? hideIncompleteMath(source) : source;

            return escapeCurrencyDollars(normalizeMathFences(normalizeMathDelimiters(shown), smooth && isStreaming));
        },
        [preprocess, smooth, isStreaming],
    );

    return (
        <MarkdownTextPrimitive
            disallowedElements={['hr']}
            unwrapDisallowed
            remarkPlugins={[[remarkGfm, { singleTilde: false }], remarkMath]}
            rehypePlugins={[[rehypeKatex, KATEX_OPTIONS], rehypeKatexFallback]}
            className="aui-md markdown prose"
            components={defaultComponents}
            componentsByLanguage={componentsByLanguage}
            preprocess={preprocessWithMath}
            smooth={smooth}
            defer
        />
    );
};

export const MarkdownText = memo(MarkdownTextImpl);

const CODE_LANGUAGE_LABELS: Record<string, string> = {
    bash: 'Bash',
    c: 'C',
    cpp: 'C++',
    csharp: 'C#',
    css: 'CSS',
    dart: 'Dart',
    dockerfile: 'Dockerfile',
    go: 'Go',
    graphql: 'GraphQL',
    html: 'HTML',
    java: 'Java',
    js: 'JavaScript',
    json: 'JSON',
    jsx: 'JavaScript JSX',
    javascript: 'JavaScript',
    kotlin: 'Kotlin',
    markdown: 'Markdown',
    md: 'Markdown',
    php: 'PHP',
    powershell: 'PowerShell',
    py: 'Python',
    python: 'Python',
    r: 'R',
    ruby: 'Ruby',
    rust: 'Rust',
    sass: 'Sass',
    scala: 'Scala',
    scss: 'SCSS',
    shell: 'Shell',
    sh: 'Shell',
    sql: 'SQL',
    swift: 'Swift',
    ts: 'TypeScript',
    tsx: 'TypeScript TSX',
    typescript: 'TypeScript',
    vue: 'Vue',
    xml: 'XML',
    yaml: 'YAML',
    yml: 'YAML',
    zsh: 'Zsh',
};

const codeBlockSurfaceClassName = 'bg-gray-800 text-gray-200';

const CodeHeader: FC<CodeHeaderProps> = ({ language, code }) => {
    const normalizedLanguage = language?.toLowerCase();
    const languageLabel = normalizedLanguage ? (CODE_LANGUAGE_LABELS[normalizedLanguage] ?? language) : language;
    const copyButtonClassName = 'text-gray-200 hover:text-gray-200';

    const renderCopyButton = (className?: string) => {
        if (!code) return null;

        return <CopyButton text={code} className={className} buttonType="default" />;
    };

    if (!language || normalizedLanguage === 'unknown') {
        const floatingCopyButton = renderCopyButton(cn(copyButtonClassName, 'absolute top-3 right-3 z-10'));

        if (!floatingCopyButton) return null;

        return <div className="relative h-0">{floatingCopyButton}</div>;
    }

    return (
        <div
            data-code-header
            className={cn(
                'aui-md-code-header flex items-center justify-between rounded-t-md px-4 pt-3 pb-1 text-xs',
                codeBlockSurfaceClassName,
            )}
        >
            <span className="flex items-center gap-1.5 text-[0.72rem] leading-none font-semibold! text-white">
                <Code2Icon className="size-3 text-white" aria-hidden="true" />
                {languageLabel}
            </span>
            {renderCopyButton(copyButtonClassName)}
        </div>
    );
};

const MermaidCodeBlock: FC<SyntaxHighlighterProps> = ({ code }) => {
    const isStreaming = useAuiState((state) => state.thread.isRunning);

    return <MermaidDiagram chart={code} isStreaming={isStreaming} />;
};

const HtmlSvgPreviewCodeBlock: FC<SyntaxHighlighterProps> = ({ code, language }) => {
    const isStreaming = useAuiState((state) => state.thread.isRunning);

    return <HtmlSvgPreview code={code} language={language} isStreaming={isStreaming} />;
};

const componentsByLanguage = {
    mermaid: {
        CodeHeader: () => null,
        SyntaxHighlighter: MermaidCodeBlock,
    },
    svg: {
        CodeHeader: () => null,
        SyntaxHighlighter: HtmlSvgPreviewCodeBlock,
    },
    html: {
        CodeHeader: () => null,
        SyntaxHighlighter: HtmlSvgPreviewCodeBlock,
    },
    xml: {
        CodeHeader: () => null,
        SyntaxHighlighter: HtmlSvgPreviewCodeBlock,
    },
};

// memoizeMarkdownComponents strips the `node` prop before forwarding to components,
// so any component that needs the HAST node (e.g. for CSV export) must live outside it.
const memoizedComponents = memoizeMarkdownComponents({
    h1: ({ className, ...props }) => (
        <h1
            className={cn(
                'aui-md-h1 mb-2 scroll-m-20 text-base font-semibold! text-foreground! first:mt-[-8px]! last:mb-0',
                className,
            )}
            {...props}
        />
    ),
    h2: ({ className, ...props }) => (
        <h2
            className={cn(
                'aui-md-h2 mt-3 mb-1.5 scroll-m-20 text-sm font-semibold! text-foreground! first:mt-0 last:mb-0',
                className,
            )}
            {...props}
        />
    ),
    h3: ({ className, ...props }) => (
        <h3
            className={cn(
                'aui-md-h3 mt-2.5 mb-1 scroll-m-20 text-sm font-semibold! text-foreground! first:mt-0 last:mb-0',
                className,
            )}
            {...props}
        />
    ),
    h4: ({ className, ...props }) => (
        <h4
            className={cn('aui-md-h4 mt-2 mb-1 scroll-m-20 text-sm font-medium first:mt-0 last:mb-0', className)}
            {...props}
        />
    ),
    h5: ({ className, ...props }) => (
        <h5 className={cn('aui-md-h5 mt-2 mb-1 text-sm font-medium first:mt-0 last:mb-0', className)} {...props} />
    ),
    h6: ({ className, ...props }) => (
        <h6 className={cn('aui-md-h6 mt-2 mb-1 text-sm font-medium first:mt-0 last:mb-0', className)} {...props} />
    ),
    p: ({ className, ...props }) => (
        <p className={cn('aui-md-p my-2.5 leading-normal first:mt-0 last:mb-0', className)} {...props} />
    ),
    a: ({ className, children, href, ...props }) => {
        if (href?.endsWith(CITATION_HREF_SUFFIX)) {
            return <CitationChip url={href.slice(0, -CITATION_HREF_SUFFIX.length)} />;
        }

        return (
            <a
                className={cn('aui-md-a text-primary underline underline-offset-2 hover:text-primary/80', className)}
                target="_blank"
                rel="noopener noreferrer"
                href={href}
                {...props}
            >
                <InsideLinkContext.Provider value={true}>{children}</InsideLinkContext.Provider>
            </a>
        );
    },
    img: ({ src, alt, className, title }) => {
        if (!src || src.trim() === '') {
            return null;
        }

        return <LightboxImage src={src} alt={alt || ''} title={title} className={cn('aui-md-img', className)} />;
    },
    blockquote: ({ className, ...props }) => (
        <blockquote
            className={cn(
                'aui-md-blockquote relative my-2.5! border-l-0! pl-3! text-muted-foreground italic',
                'before:absolute before:inset-y-0 before:left-0 before:w-1 before:rounded-sm before:bg-primary/50',
                className,
            )}
            {...props}
        />
    ),
    ul: ({ className, ...props }) => (
        <ul className={cn('aui-md-ul my-2 list-disc marker:text-muted-foreground [&>li]:mt-1', className)} {...props} />
    ),
    ol: ({ className, ...props }) => (
        <ol
            className={cn('aui-md-ol my-2 list-decimal marker:text-muted-foreground [&>li]:mt-1', className)}
            {...props}
        />
    ),
    hr: ({ className, ...props }) => (
        <hr className={cn('aui-md-hr my-2 border-muted-foreground/20', className)} {...props} />
    ),
    li: ({ className, ...props }) => <li className={cn('aui-md-li pl-4 leading-normal', className)} {...props} />,
    sup: ({ className, ...props }) => (
        <sup className={cn('aui-md-sup [&>a]:text-xs [&>a]:no-underline', className)} {...props} />
    ),
    pre: ({ className, ...props }) => (
        <pre
            className={cn(
                'aui-md-pre scrollbar-controller scrollbar-horizontal mt-0! rounded-md px-4 pt-3 pr-12 pb-4 text-xs leading-relaxed',
                codeBlockSurfaceClassName,
                '[[data-code-header]+&]:mt-0! [[data-code-header]+&]:rounded-t-none! [[data-code-header]+&]:pt-2',
                className,
            )}
            {...props}
        />
    ),
    code: function Code({ className, ...props }) {
        const isCodeBlock = useIsMarkdownCodeBlock();

        return (
            <code
                className={cn(
                    !isCodeBlock && 'aui-md-inline-code markdown-inline-code rounded-md border px-1.5 py-0.5 font-mono',
                    className,
                )}
                {...props}
            />
        );
    },
    CodeHeader,
});

// MarkdownTable must be outside memoizeMarkdownComponents — it needs the `node`
// prop (HAST element) to build the CSV for the download button, and
// memoizeMarkdownComponents strips that prop before forwarding to components.
const defaultComponents = {
    ...memoizedComponents,
    table: MarkdownTable,
};
