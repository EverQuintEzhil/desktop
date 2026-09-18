import { ChevronDownIcon, ListIcon } from 'lucide-react';
import { useMemo, useState, type RefObject } from 'react';

import { Button } from '@/components/ui/button';
import { DropdownMenu } from '@/components/ui/dropdown-menu';
import { showErrorToast, showSuccessToast } from '@/utils';

import { buildReportOutline } from './research-contract';
import { downloadReportMarkdown, downloadReportPdf } from './research-report-export';

interface Props {
    title: string;
    markdown: string;
    /** The rendered report, owned by the pane body so these actions can sit in the pane header. */
    bodyRef: RefObject<HTMLDivElement | null>;
}

/** Contents, Copy and Download for the report — Gemini's Canvas actions, in the pane header. */
const ResearchReportActions = ({ title, markdown, bodyRef }: Props) => {
    const outline = useMemo(() => buildReportOutline(markdown), [markdown]);
    const [isExportingPdf, setIsExportingPdf] = useState(false);

    // Scrolled by position rather than by anchor id: the markdown renderer owns the heading
    // elements and does not mint ids, and the outline is built from the same document in the
    // same order, so the nth heading in the DOM is the nth entry here.
    const scrollToHeading = (position: number) => {
        const headings = bodyRef.current?.querySelectorAll('h1, h2, h3');

        headings?.[position]?.scrollIntoView({ block: 'start', behavior: 'smooth' });
    };

    const copyReport = async () => {
        try {
            await navigator.clipboard.writeText(markdown);
            showSuccessToast('Report copied');
        } catch {
            showErrorToast('Could not copy the report');
        }
    };

    const downloadPdf = async () => {
        const node = bodyRef.current;

        if (!node) return;

        setIsExportingPdf(true);

        try {
            await downloadReportPdf(title, node);
        } catch {
            // Leaving the report mid-capture detaches the node and fails the export. That is the
            // reader's own doing, so it gets no error — only a still-mounted report reports.
            if (node.isConnected) showErrorToast('Could not export the report as PDF');
        } finally {
            setIsExportingPdf(false);
        }
    };

    const renderContentsMenu = () => {
        if (outline.length === 0) return null;

        return (
            <DropdownMenu
                align="start"
                contentClassName="max-h-[60svh] w-[280px] scrollbar-controller scrollbar-vertical"
                // The menu wraps each label in a flex-item span that will not shrink below its
                // text, so long headings widened the popover and grew a horizontal scrollbar.
                itemClassName="[&>span]:min-w-0 [&>span]:truncate"
                trigger={
                    <Button variant="ghost" size="xs" className="gap-1.5">
                        <ListIcon className="size-3.5" />
                        Contents
                    </Button>
                }
                options={outline.map((heading, position) => ({
                    // Indented by level so the menu reads as the report's own structure.
                    label: (
                        <span title={heading.text} style={{ paddingLeft: `${(heading.level - 1) * 12}px` }}>
                            {heading.text}
                        </span>
                    ),
                    value: `${position}`,
                    onClick: () => scrollToHeading(position),
                }))}
            />
        );
    };

    return (
        <div className="research-report-actions flex shrink-0 items-center gap-1">
            {renderContentsMenu()}
            {/* Copy is the common action, so it stays one click; the formats hang off the chevron
                beside it rather than becoming two more buttons. */}
            <div className="research-report-copy-split flex items-center overflow-hidden rounded-lg border border-border">
                <Button variant="ghost" size="xs" className="rounded-none" onClick={copyReport}>
                    Copy
                </Button>
                <span className="h-4 w-px bg-border" aria-hidden />
                <DropdownMenu
                    align="end"
                    trigger={
                        <Button
                            variant="ghost"
                            size="icon-xs"
                            className="rounded-none"
                            aria-label="Download report"
                            disabled={isExportingPdf}
                        >
                            <ChevronDownIcon />
                        </Button>
                    }
                    options={[
                        {
                            label: 'Download as Markdown',
                            value: 'markdown',
                            onClick: () => downloadReportMarkdown(title, markdown),
                        },
                        {
                            label: isExportingPdf ? 'Preparing PDF…' : 'Download as PDF',
                            value: 'pdf',
                            onClick: () => void downloadPdf(),
                        },
                    ]}
                />
            </div>
        </div>
    );
};

export default ResearchReportActions;
