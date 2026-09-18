import { FileJsonIcon, LayoutListIcon, XIcon } from 'lucide-react';
import { useMemo } from 'react';

import { CopyButton } from '@/components';
import JSONEditor from '@/components/json-editor';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import {
    formatExplorerColumnHeader,
    renderExplorerCellValue,
    sortExplorerColumnKeys,
} from './explorer-cell-formatters';
import type { DocumentRow } from './types';

type ExplorerDocumentDetailProps = {
    document: DocumentRow;
    onCollapse: () => void;
};

const FULL_WIDTH_KEYS = new Set(['description', 'body', 'content', 'notes', 'summary', 'message', '_id']);

const isFullWidthField = (key: string, value: unknown): boolean => {
    if (FULL_WIDTH_KEYS.has(key.toLowerCase())) return true;
    if (key === '_id') return true;
    if (typeof value === 'object' && value !== null) return true;

    return typeof value === 'string' && value.length > 80;
};

export const ExplorerDocumentDetail = ({ document, onCollapse }: ExplorerDocumentDetailProps) => {
    const documentId = String(document._id);
    const documentJson = useMemo(() => JSON.stringify(document, null, 2), [document]);

    const fields = useMemo(
        () =>
            sortExplorerColumnKeys(Object.keys(document)).map((key) => {
                return {
                    key,
                    label: formatExplorerColumnHeader(key),
                    value: document[key],
                    fullWidth: isFullWidthField(key, document[key]),
                };
            }),
        [document],
    );

    const renderDetailsGrid = () => (
        <dl className="data-explorer-detail-grid flex flex-col bg-border/70">
            {fields.map((field) => (
                <div
                    key={field.key}
                    className={cn(
                        'flex min-w-0 flex-col bg-background px-4 py-2',
                        field.fullWidth ? 'col-span-full' : '',
                    )}
                >
                    <dt className="text-[11px] font-medium tracking-wide text-muted-foreground uppercase">
                        {field.label}
                    </dt>
                    <dd className="min-w-0 text-sm text-foreground">
                        {renderExplorerCellValue({
                            key: field.key,
                            value: field.value,
                            variant: 'detail',
                        })}
                    </dd>
                </div>
            ))}
        </dl>
    );

    const renderJsonView = () => (
        <div className="data-explorer-nested-json flex h-[min(320px,45vh)] min-h-48 min-w-0 flex-col overflow-hidden">
            <JSONEditor
                content={{ json: document }}
                readOnly
                mode="text"
                mainMenuBar={false}
                statusBar={false}
                className="h-full min-h-0 min-w-0 flex-1"
            />
        </div>
    );

    return (
        <div
            className={cn(
                'data-explorer-document-detail flex w-full min-w-0 flex-col overflow-hidden',
                'border-y border-border/60 bg-muted/10',
            )}
        >
            <div
                className={cn(
                    'flex shrink-0 items-center justify-between gap-3',
                    'border-b border-border/60 bg-muted/30 px-4 py-2.5',
                )}
            >
                <div className="flex min-w-0 items-center gap-2">
                    <div
                        className={cn(
                            'flex size-7 shrink-0 items-center justify-center rounded-md',
                            'bg-primary/10 text-primary',
                        )}
                    >
                        <LayoutListIcon className="size-3.5" />
                    </div>
                    <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">Document details</p>
                        <p className="truncate font-mono text-xs text-muted-foreground">{documentId}</p>
                    </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                    <CopyButton text={documentJson} className="copy-button h-8 w-8" tooltipContent="Copy JSON" />
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="text-muted-foreground"
                        onClick={(event) => {
                            event.stopPropagation();
                            onCollapse();
                        }}
                        aria-label="Collapse document"
                    >
                        <XIcon className="size-4" />
                    </Button>
                </div>
            </div>

            <Tabs defaultValue="details" className="flex min-h-0 flex-1 flex-col gap-0">
                <div className="shrink-0 border-b border-border/60 bg-background px-4 py-2">
                    <TabsList variant="line" className="h-8 w-auto gap-1 p-0">
                        <TabsTrigger value="details" className="h-7 gap-1.5 px-2.5 text-xs">
                            <LayoutListIcon className="size-3.5" />
                            Details
                        </TabsTrigger>
                        <TabsTrigger value="json" className="h-7 gap-1.5 px-2.5 text-xs">
                            <FileJsonIcon className="size-3.5" />
                            Raw JSON
                        </TabsTrigger>
                    </TabsList>
                </div>
                <TabsContent
                    value="details"
                    className={cn(
                        'scrollbar-controller scrollbar-vertical m-0 min-h-0 flex-1 data-[state=inactive]:hidden',
                        'max-h-[min(360px,50vh)]',
                    )}
                >
                    {renderDetailsGrid()}
                </TabsContent>
                <TabsContent value="json" className="m-0 min-h-0 flex-1 data-[state=inactive]:hidden">
                    {renderJsonView()}
                </TabsContent>
            </Tabs>
        </div>
    );
};
