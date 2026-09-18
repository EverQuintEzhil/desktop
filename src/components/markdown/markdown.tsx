import { escapeCurrencyDollars, normalizeMathDelimiters } from '@assistant-ui/react-markdown';
import { CheckIcon, CopyIcon, DownloadIcon, Maximize2Icon, XIcon } from 'lucide-react';
import React, { useEffect, useMemo, useRef, useState } from 'react';
import ReactMarkdown, { type ExtraProps } from 'react-markdown';
import addClasses from 'rehype-class-names';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import remarkMath from 'remark-math';

import LightboxImage, { InsideLinkContext } from '@/components/lightbox-image';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

import CopyButton from '../copy-button';
import { Dialog, DialogBody, DialogClose, DialogContent, DialogHeader, DialogTitle } from '../ui/dialog';
import { SimpleTooltip } from '../ui/simple-tooltip';

import { KATEX_OPTIONS } from './constants';
import MermaidDiagram from './mermaid-diagram';
import { normalizeMathFences, rehypeKatexFallback } from './utils';

import 'katex/dist/katex.min.css';

import './katex-protect.css';
import './markdown.scss';

export interface MarkdownProps {
    children: string;
    isStreaming?: boolean;
}

type CodeBlockDetails = { language: string; meta: string; text: string };

const LANGUAGE_CLASS_RE = /language-(\S+)/;

type MarkdownCodeProps = React.ComponentProps<'code'> & ExtraProps;
type MarkdownTableProps = React.ComponentProps<'table'> & ExtraProps;
type PreCodeProps = MarkdownCodeProps;
type HastElement = NonNullable<ExtraProps['node']>;
type HastChild = HastElement['children'][number];

const hastToText = (node: HastChild): string => {
    if (node.type === 'text') return node.value ?? '';
    if (node.type !== 'element') return '';

    return (node.children ?? []).map(hastToText).join('');
};

type TableRows = { head: string[][]; body: string[][] };

const EMPTY_TABLE_ROWS: TableRows = { head: [], body: [] };

const hastTableToRows = (node: HastElement): TableRows => {
    const head: string[][] = [];
    const body: string[][] = [];

    for (const section of node.children ?? []) {
        if (section.type !== 'element' || !['thead', 'tbody'].includes(section.tagName)) continue;

        const target = section.tagName === 'thead' ? head : body;

        for (const tr of section.children ?? []) {
            if (tr.type !== 'element' || tr.tagName !== 'tr') continue;

            const cells = (tr.children ?? [])
                .filter((c): c is HastElement => c.type === 'element' && ['th', 'td'].includes(c.tagName))
                .map((c) => hastToText(c).trim());

            if (cells.length) target.push(cells);
        }
    }

    return { head, body };
};

const rowsToCsv = ({ head, body }: TableRows): string =>
    [...head, ...body]
        .map((row) =>
            row
                .map((cell) => {
                    const escaped = cell.replace(/"/g, '""');

                    return /[,"\n]/.test(escaped) ? `"${escaped}"` : escaped;
                })
                .join(','),
        )
        .join('\n');

const rowsToTsv = ({ head, body }: TableRows): string =>
    [...head, ...body].map((row) => row.map((cell) => cell.replace(/[\t\r\n]+/g, ' ')).join('\t')).join('\n');

const escapeHtml = (value: string): string =>
    value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const rowsToHtml = ({ head, body }: TableRows): string => {
    const renderRow = (cells: string[], tag: 'th' | 'td') =>
        `<tr>${cells.map((cell) => `<${tag}>${escapeHtml(cell)}</${tag}>`).join('')}</tr>`;
    const thead = head.length ? `<thead>${head.map((row) => renderRow(row, 'th')).join('')}</thead>` : '';
    const tbody = body.length ? `<tbody>${body.map((row) => renderRow(row, 'td')).join('')}</tbody>` : '';

    return `<table>${thead}${tbody}</table>`;
};

const downloadCsv = (csv: string) => {
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `table_${new Date().toISOString().slice(0, 19).replace(/-|:/g, '')}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
};

const reactNodeToText = (children: React.ReactNode): string =>
    React.Children.toArray(children)
        .map((child) => {
            if (typeof child === 'string' || typeof child === 'number') {
                return String(child);
            }
            if (React.isValidElement(child)) {
                const elementChild = child as React.ReactElement<{ children?: React.ReactNode }>;

                if (elementChild.props.children) {
                    return reactNodeToText(elementChild.props.children);
                }
            }

            return '';
        })
        .join('');

const MarkdownCode = ({ children, className, ...rest }: MarkdownCodeProps) => {
    const languageMatch = LANGUAGE_CLASS_RE.exec(className ?? '');

    if (languageMatch) {
        return (
            <code className={className} {...rest}>
                {children}
            </code>
        );
    }

    return (
        <code
            className={cn('markdown-inline-code rounded-sm border px-1 py-0.5 font-mono text-[0.85em]', className)}
            {...rest}
        >
            {children}
        </code>
    );
};

const extractCodeBlockDetails = (children: React.ReactNode): CodeBlockDetails => {
    const codeElement = React.Children.toArray(children).find(
        (child): child is React.ReactElement<PreCodeProps> =>
            React.isValidElement(child) && (child.type === 'code' || child.type === MarkdownCode),
    );

    if (!codeElement?.props.children) {
        return { language: '', meta: '', text: '' };
    }

    const languageMatch = LANGUAGE_CLASS_RE.exec(codeElement.props.className ?? '');
    const meta = codeElement.props.node?.data?.meta;

    return {
        language: languageMatch?.[1]?.toLowerCase() ?? '',
        meta: typeof meta === 'string' ? meta : '',
        text: reactNodeToText(codeElement.props.children).trim(),
    };
};

const PreBlock = ({
    children,
    isStreaming = false,
    ...rest
}: React.HTMLAttributes<HTMLPreElement> & { isStreaming?: boolean }) => {
    const { language, meta, text: codeText } = extractCodeBlockDetails(children);

    if (language === 'mermaid' && codeText) {
        return <MermaidDiagram chart={[meta, codeText].filter(Boolean).join('\n')} isStreaming={isStreaming} />;
    }

    return (
        <div className="code-block-container">
            <pre {...rest}>{children}</pre>
            {codeText ? (
                <CopyButton
                    text={codeText}
                    className="code-copy-button bg-card hover:bg-background"
                    buttonType="default"
                />
            ) : null}
        </div>
    );
};

export const MarkdownTable = ({ node, children, ...rest }: MarkdownTableProps) => {
    const [isFullscreenOpen, setIsFullscreenOpen] = useState(false);
    const [isCopied, setIsCopied] = useState(false);
    const copyTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (copyTimeoutRef.current) {
                clearTimeout(copyTimeoutRef.current);
            }
        };
    }, []);

    const tableRows = node ? hastTableToRows(node) : EMPTY_TABLE_ROWS;
    const hasRows = tableRows.head.length > 0 || tableRows.body.length > 0;
    const csv = hasRows ? rowsToCsv(tableRows) : '';

    const markCopied = () => {
        setIsCopied(true);
        if (copyTimeoutRef.current) {
            clearTimeout(copyTimeoutRef.current);
        }
        copyTimeoutRef.current = setTimeout(() => setIsCopied(false), 2000);
    };

    const handleCopyTable = () => {
        const tsv = rowsToTsv(tableRows);

        const writeRich = async () => {
            const item = new ClipboardItem({
                'text/plain': new Blob([tsv], { type: 'text/plain' }),
                'text/html': new Blob([rowsToHtml(tableRows)], { type: 'text/html' }),
            });

            await navigator.clipboard.write([item]);
        };

        writeRich()
            .catch(() => navigator.clipboard.writeText(tsv))
            .then(markCopied)
            .catch(() => undefined);
    };

    const renderTable = (className?: string) => (
        <table {...rest} className={cn(rest.className, className)}>
            {children}
        </table>
    );

    const renderDownloadButton = (className?: string, withTooltip = true) => {
        if (!csv) return null;

        const button = (
            <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className={className}
                onClick={() => downloadCsv(csv)}
                aria-label="Download table as CSV"
            >
                <DownloadIcon />
            </Button>
        );

        if (!withTooltip) return button;

        return (
            <SimpleTooltip content="Download CSV" side="bottom">
                {button}
            </SimpleTooltip>
        );
    };

    const renderCopyButton = (className?: string, withTooltip = true) => {
        if (!hasRows) return null;

        const button = (
            <Button
                type="button"
                variant="outline"
                size="icon-sm"
                className={className}
                onClick={handleCopyTable}
                aria-label="Copy table"
            >
                {isCopied ? <CheckIcon /> : <CopyIcon />}
            </Button>
        );

        if (!withTooltip) return button;

        return (
            <SimpleTooltip content="Copy table" side="bottom">
                {button}
            </SimpleTooltip>
        );
    };

    return (
        <div className="table-container-wrapper">
            <div className="table-actions" role="group" aria-label="Table actions">
                {renderCopyButton('table-action-button')}
                <Button
                    type="button"
                    variant="outline"
                    size="icon-sm"
                    className="table-action-button"
                    onClick={() => setIsFullscreenOpen(true)}
                    aria-label="Open table fullscreen"
                >
                    <Maximize2Icon />
                </Button>
                {renderDownloadButton('table-action-button')}
            </div>

            <div className="table-container">{renderTable()}</div>

            <Dialog open={isFullscreenOpen} onOpenChange={setIsFullscreenOpen}>
                <DialogContent
                    className={cn(
                        'table-fullscreen-dialog-content markdown prose grid-rows-[auto_minmax(0,1fr)]',
                        'top-0 left-0 h-dvh w-screen max-w-none translate-x-0 translate-y-0',
                        'overflow-hidden rounded-none border-0 p-0 shadow-none',
                    )}
                    overlayClassName="bg-black/50"
                    aria-describedby={undefined}
                    onOpenAutoFocus={(e) => e.preventDefault()}
                >
                    <DialogHeader className="table-fullscreen-header flex-row items-center gap-2">
                        <DialogTitle className="table-fullscreen-title">Table</DialogTitle>
                        <div
                            className="table-fullscreen-actions ml-auto"
                            role="group"
                            aria-label="Fullscreen table actions"
                        >
                            {renderCopyButton('table-fullscreen-action-button')}
                            {renderDownloadButton('table-fullscreen-action-button')}
                            <DialogClose asChild>
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon-sm"
                                    className="table-fullscreen-action-button"
                                    aria-label="Close fullscreen table"
                                >
                                    <XIcon />
                                </Button>
                            </DialogClose>
                        </div>
                    </DialogHeader>
                    <DialogBody className="table-fullscreen-body">
                        <div className="table-container table-container-fullscreen">
                            {renderTable('table-fullscreen')}
                        </div>
                    </DialogBody>
                </DialogContent>
            </Dialog>
        </div>
    );
};

const DISALLOWED_ELEMENTS = ['hr'];

const BASE_MARKDOWN_COMPONENTS = {
    a: ({
        href,
        children,
        ...rest
    }: React.AnchorHTMLAttributes<HTMLAnchorElement> & { children?: React.ReactNode }) => (
        <a href={href} target="_blank" rel="noopener noreferrer" {...rest}>
            <InsideLinkContext.Provider value={true}>{children}</InsideLinkContext.Provider>
        </a>
    ),
    img: ({ src, alt, className, title }: React.ImgHTMLAttributes<HTMLImageElement>) => {
        if (!src || src.trim() === '') {
            return null;
        }

        return <LightboxImage src={src} alt={alt || ''} title={title} className={className} />;
    },
    code: MarkdownCode,
    table: MarkdownTable,
};

// https://github.com/remarkjs/react-markdown/blob/main/changelog.md
const Markdown: React.FC<MarkdownProps> = ({ children, isStreaming = false, ...props }) => {
    const remarkPlugins = useMemo(
        () =>
            [[remarkGfm, { singleTilde: false }], remarkMath] as React.ComponentProps<
                typeof ReactMarkdown
            >['remarkPlugins'],
        [],
    );
    const rehypePlugins = useMemo(
        () =>
            [
                [addClasses, { img: 'img', a: 'a' }],
                [rehypeKatex, KATEX_OPTIONS],
                rehypeKatexFallback,
            ] as React.ComponentProps<typeof ReactMarkdown>['rehypePlugins'],
        [],
    );
    const components = useMemo(
        () => ({
            ...BASE_MARKDOWN_COMPONENTS,
            pre: (props: React.HTMLAttributes<HTMLPreElement>) => <PreBlock {...props} isStreaming={isStreaming} />,
        }),
        [isStreaming],
    );
    const normalizedChildren = useMemo(
        () => escapeCurrencyDollars(normalizeMathFences(normalizeMathDelimiters(children))),
        [children],
    );

    return (
        <div className="markdown prose" {...props}>
            <ReactMarkdown
                disallowedElements={DISALLOWED_ELEMENTS}
                unwrapDisallowed
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={components}
            >
                {normalizedChildren}
            </ReactMarkdown>
        </div>
    );
};

export default Markdown;
