import { useAuiState } from '@assistant-ui/react';
import type { Element, Root, RootContent } from 'hast';
import { CheckIcon, CopyIcon } from 'lucide-react';
import React, { useEffect, useRef, useState } from 'react';
import rehypeStringify from 'rehype-stringify';
import remarkGfm from 'remark-gfm';
import remarkParse from 'remark-parse';
import remarkRehype from 'remark-rehype';
import { unified } from 'unified';

import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

// Only paste-safe properties belong here. Google Docs and Word convert any
// pasted `background-color` into per-line text highlighting (gray boxes) and
// ignore border-radius/overflow, so code and table headers stay backgroundless
// plain monospace/bold — matching what ChatGPT and Claude put on the clipboard.
// Sizes use pt (the unit Docs/Word use natively); em resolution is unreliable
// in paste importers. line-height is omitted so the destination document's
// default line spacing wins.
const INLINE_STYLE_BY_TAG: Record<string, string> = {
    h1: 'font-size:20pt;font-weight:700;margin:14pt 0 6pt',
    h2: 'font-size:16pt;font-weight:700;margin:12pt 0 6pt',
    h3: 'font-size:14pt;font-weight:700;margin:12pt 0 4pt',
    h4: 'font-size:12pt;font-weight:700;margin:10pt 0 4pt',
    h5: 'font-weight:700;margin:10pt 0 4pt',
    h6: 'font-weight:700;margin:10pt 0 4pt',
    p: 'margin:6pt 0',
    ul: 'margin:6pt 0;padding-left:24pt',
    ol: 'margin:6pt 0;padding-left:24pt',
    li: 'margin:3pt 0',
    blockquote: 'margin:6pt 0;padding:0 12pt;border-left:3px solid #d0d7de;color:#57606a',
    table: 'border-collapse:collapse;margin:6pt 0',
    th: 'border:1px solid #d0d7de;padding:5pt 10pt;font-weight:700;text-align:left',
    td: 'border:1px solid #d0d7de;padding:5pt 10pt',
    pre: 'margin:6pt 0',
    code: 'font-family:ui-monospace,SFMono-Regular,Menlo,Consolas,monospace;font-size:10pt',
    a: 'color:#0969da;text-decoration:underline',
    hr: 'border:none;border-top:1px solid #d0d7de;margin:12pt 0',
    img: 'max-width:100%',
    strong: 'font-weight:700',
    em: 'font-style:italic',
};

const applyInlineStyle = (node: Element, style: string): void => {
    const properties = node.properties ?? {};
    const existing = typeof properties.style === 'string' && properties.style ? properties.style : '';

    node.properties = {
        ...properties,
        style: existing ? `${style};${existing}` : style,
    };
};

const styleNode = (node: RootContent): void => {
    if (node.type !== 'element') {
        return;
    }

    const style = INLINE_STYLE_BY_TAG[node.tagName];

    if (style) {
        applyInlineStyle(node, style);
    }

    node.children.forEach(styleNode);
};

// Bakes paste-safe styles onto each element as inline `style=` attributes.
// Target apps (Google Docs, Word, Gmail) strip <style> blocks and classes, so
// styling must live on the elements themselves.
const rehypeInlineStyles =
    () =>
    (tree: Root): void => {
        tree.children.forEach(styleNode);
    };

// Markdown → HTML via the unified pipeline directly (not react-dom/server's
// renderToStaticMarkup). renderToStaticMarkup reads React internals, which
// crash when the host supplies React as a UMD global whose version differs
// from the bundled react-dom/server (`getCurrentStack` undefined). This path
// touches no React, so it is host-React-agnostic.
const markdownToHtml = (markdown: string): string => {
    const body = unified()
        .use(remarkParse)
        .use(remarkGfm, { singleTilde: false })
        .use(remarkRehype)
        .use(rehypeInlineStyles)
        .use(rehypeStringify)
        .processSync(markdown)
        .toString();

    return `<div style="font-family:Arial, Helvetica, sans-serif">${body}</div>`;
};

interface MessageCopyFormattedButtonProps {
    className?: string;
    'aria-label'?: string;
}

const stripRelatedQuestions = (text: string): string =>
    text
        .replace(/<related_questions>[\s\S]*?<\/related_questions>/g, '')
        .replace(/<related_questions>[\s\S]*$/g, '')
        .trimEnd();

const MessageCopyFormattedButton = ({ className, 'aria-label': ariaLabel }: MessageCopyFormattedButtonProps) => {
    const parts = useAuiState((s) => s.message.parts);
    const role = useAuiState((s) => s.message.role);
    const status = useAuiState((s) => s.message.status?.type);
    const [isCopied, setIsCopied] = useState(false);
    const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (timeoutRef.current) {
                clearTimeout(timeoutRef.current);
            }
        };
    }, []);

    const markdown = stripRelatedQuestions(
        parts
            .filter((part) => part.type === 'text')
            .map((part) => part.text)
            .join('\n\n'),
    );

    const isRunning = role === 'assistant' && status === 'running';
    const isDisabled = isRunning || !markdown;

    const markClipboardSuccess = () => {
        setIsCopied(true);
        if (timeoutRef.current) {
            clearTimeout(timeoutRef.current);
        }
        timeoutRef.current = setTimeout(() => {
            setIsCopied(false);
        }, 2000);
    };

    const copyPlainText = () => navigator.clipboard.writeText(markdown);

    const copyMarkdownHtml = async () => {
        const html = markdownToHtml(markdown);

        try {
            const item = new ClipboardItem({
                'text/html': new Blob([html], { type: 'text/html' }),
                'text/plain': new Blob([markdown], { type: 'text/plain' }),
            });

            await navigator.clipboard.write([item]);
        } catch {
            await copyPlainText();
        }
    };

    const handleCopy = async (e: React.MouseEvent<HTMLButtonElement>) => {
        e.stopPropagation();
        e.preventDefault();

        if (!markdown) {
            return;
        }

        const canWriteRichClipboard =
            typeof ClipboardItem !== 'undefined' && typeof navigator.clipboard?.write === 'function';

        try {
            if (canWriteRichClipboard) {
                await copyMarkdownHtml();
            } else {
                await copyPlainText();
            }

            markClipboardSuccess();
        } catch {
            try {
                await copyPlainText();
                markClipboardSuccess();
            } catch (error) {
                console.error('Failed to copy formatted content', error);
            }
        }
    };

    const onClick = (e: React.MouseEvent<HTMLButtonElement>) => {
        handleCopy(e).catch((error) => {
            console.error('Failed to copy formatted content', error);
        });
    };

    return (
        <Button
            size="icon-xs"
            variant="ghost"
            className={cn('justify-center', className)}
            aria-label={ariaLabel}
            disabled={isDisabled}
            onClick={onClick}
        >
            {isCopied ? <CheckIcon /> : <CopyIcon />}
        </Button>
    );
};

export default MessageCopyFormattedButton;
