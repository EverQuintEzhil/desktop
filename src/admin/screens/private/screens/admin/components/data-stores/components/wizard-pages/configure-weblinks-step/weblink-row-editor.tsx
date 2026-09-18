import { ChevronDownIcon, ChevronUpIcon, InfoIcon, TrashIcon } from 'lucide-react';
import { useState } from 'react';

import { ACTION_BUTTON_CLASS_NAME } from '@/components/file-list';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import { cn } from '@/lib/utils';

import { getWeblinkRowErrors, WEBLINK_TYPE_OPTIONS, type WeblinkFormRow } from './weblinks-validation';

interface Props {
    row: WeblinkFormRow;
    isExpanded: boolean;
    disabled?: boolean;
    showErrors: boolean;
    onToggleExpanded: () => void;
    onChange: (patch: Partial<WeblinkFormRow>) => void;
    onRemove: () => void;
}

const fieldErrorClass = 'text-xs text-destructive';

const WeblinkRowEditor = ({ row, isExpanded, disabled, showErrors, onToggleExpanded, onChange, onRemove }: Props) => {
    const [advancedOpen, setAdvancedOpen] = useState(false);
    const errors = getWeblinkRowErrors(row);
    const rowHasErrors = showErrors && Object.values(errors).some(Boolean);

    // z-52: the Select's popover content sits at z-51 and would otherwise cover the tooltip.
    const renderTypeHelp = () => (
        <SimpleTooltip
            side="right"
            className="z-52 max-w-xs text-left"
            content={
                <span className="flex flex-col gap-1.5">
                    <span>
                        <span className="font-semibold">Crawl</span>
                        {' — starts at the URL and follows links across the site, indexing every page it '}
                        {'discovers, up to the max pages/depth in advanced settings. A sitemap URL can '}
                        {'optionally steer which pages it finds.'}
                    </span>
                    <span>
                        <span className="font-semibold">Scrape</span>
                        {' — indexes only the single page at that exact URL, without following any links.'}
                    </span>
                </span>
            }
        >
            <button
                type="button"
                aria-label="About link types"
                className="rounded-full text-text-secondary outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus-ring)"
            >
                <InfoIcon className="size-3.5" />
            </button>
        </SimpleTooltip>
    );

    const renderSummary = () => {
        const displayUrl = row.url.trim() || 'New link';

        return (
            <button
                type="button"
                aria-expanded={isExpanded}
                className="min-w-0 flex-1 cursor-pointer appearance-none rounded-sm border-0 bg-transparent p-0 text-left outline-none focus-visible:ring-2 focus-visible:ring-(--color-focus-ring)"
                onClick={onToggleExpanded}
            >
                <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                    <span
                        className={cn(
                            'min-w-0 truncate text-sm font-medium transition-colors group-hover:text-primary',
                            isExpanded && 'text-primary',
                        )}
                    >
                        {displayUrl}
                    </span>
                    <Badge variant="outline" className="text-xs capitalize">
                        {row.type}
                    </Badge>
                    {rowHasErrors && (
                        <Badge variant="destructive" className="text-xs">
                            Needs attention
                        </Badge>
                    )}
                </div>
            </button>
        );
    };

    return (
        <div className="border-b border-border-secondary last:border-b-0">
            <div
                className={cn(
                    'group flex min-h-11 items-center gap-2 px-3 py-2 transition-colors hover:bg-primary/10',
                    isExpanded && 'bg-primary/10',
                )}
            >
                {renderSummary()}
                <div className="flex shrink-0 items-center gap-0.5">
                    <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        disabled={disabled}
                        onClick={onRemove}
                        aria-label="Remove link"
                        className={cn(
                            ACTION_BUTTON_CLASS_NAME,
                            'hover:bg-destructive/10 hover:text-destructive',
                            // pointer-events guard: an opacity-0 button still takes clicks, so a
                            // hidden target would delete a row on a stray click.
                            'pointer-events-none group-focus-within:pointer-events-auto group-hover:pointer-events-auto',
                            isExpanded && 'pointer-events-auto opacity-100',
                        )}
                    >
                        <TrashIcon />
                    </Button>
                    <Button
                        type="button"
                        size="icon-sm"
                        variant="ghost"
                        aria-label={isExpanded ? 'Collapse link' : 'Expand link'}
                        className="text-text-secondary hover:text-primary"
                        onClick={onToggleExpanded}
                    >
                        {isExpanded ? <ChevronUpIcon /> : <ChevronDownIcon />}
                    </Button>
                </div>
            </div>

            {isExpanded && (
                <div className="flex flex-col gap-4 border-t border-border-secondary p-4">
                    <div className="flex flex-col gap-1">
                        <Label>
                            <span>
                                URL
                                <span className="text-xs text-destructive">*</span>
                            </span>
                        </Label>
                        <Input
                            value={row.url}
                            placeholder="https://example.com"
                            disabled={disabled}
                            isErrored={showErrors && Boolean(errors.url)}
                            onChange={(e) => onChange({ url: e.target.value })}
                        />
                        {showErrors && errors.url && <span className={fieldErrorClass}>{errors.url}</span>}
                    </div>

                    <div className="flex flex-col gap-1">
                        <div className="flex items-center gap-1.5">
                            <Label>
                                <span>Type</span>
                            </Label>
                            {renderTypeHelp()}
                        </div>
                        <Select
                            variant="ghost"
                            disabled={disabled}
                            allowDeselect={false}
                            value={row.type}
                            options={WEBLINK_TYPE_OPTIONS}
                            onChange={(value) => {
                                if (!value) return;
                                onChange({ type: value });
                            }}
                        />
                    </div>

                    {row.type === 'crawl' && (
                        <div className="flex flex-col gap-1">
                            <Label>
                                <span>Sitemap URL</span>
                            </Label>
                            <Input
                                value={row.siteMapLink}
                                placeholder="https://example.com/sitemap.xml (optional)"
                                disabled={disabled}
                                isErrored={showErrors && Boolean(errors.siteMapLink)}
                                onChange={(e) => onChange({ siteMapLink: e.target.value })}
                            />
                            {showErrors && errors.siteMapLink && (
                                <span className={fieldErrorClass}>{errors.siteMapLink}</span>
                            )}
                        </div>
                    )}

                    <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
                        <CollapsibleTrigger asChild>
                            <Button type="button" variant="ghost" size="xs" className="-ml-1.5 self-start">
                                {advancedOpen ? <ChevronUpIcon /> : <ChevronDownIcon />}
                                Advanced settings
                            </Button>
                        </CollapsibleTrigger>
                        <CollapsibleContent className="flex flex-col gap-3 pt-3">
                            <Checkbox
                                checked={row.respectRobots}
                                disabled={disabled}
                                label="Respect robots.txt"
                                className="focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:ring-offset-2"
                                onChange={(_, checked) => onChange({ respectRobots: checked })}
                            />
                            {row.type === 'crawl' && (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <div className="flex flex-col gap-1">
                                        <Label>
                                            <span>Max pages</span>
                                        </Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={row.maxPages}
                                            disabled={disabled}
                                            isErrored={showErrors && Boolean(errors.maxPages)}
                                            onChange={(e) => onChange({ maxPages: e.target.value })}
                                        />
                                        {showErrors && errors.maxPages && (
                                            <span className={fieldErrorClass}>{errors.maxPages}</span>
                                        )}
                                    </div>
                                    <div className="flex flex-col gap-1">
                                        <Label>
                                            <span>Max depth</span>
                                        </Label>
                                        <Input
                                            type="number"
                                            min={1}
                                            value={row.maxDepth}
                                            disabled={disabled}
                                            isErrored={showErrors && Boolean(errors.maxDepth)}
                                            onChange={(e) => onChange({ maxDepth: e.target.value })}
                                        />
                                        {showErrors && errors.maxDepth && (
                                            <span className={fieldErrorClass}>{errors.maxDepth}</span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </CollapsibleContent>
                    </Collapsible>
                </div>
            )}
        </div>
    );
};

export default WeblinkRowEditor;
