import { ChevronRight } from 'lucide-react';

import type { McpTool } from '@/lib/api';
import { cn } from '@/lib/utils';

import type { ToolPermission } from '../hooks/use-connector-queries';

import { PermissionSwitch } from './permission-switch';

const SUMMARY_CLAMP_LENGTH = 90;

export const cleanDescription = (text: string): string =>
    text
        .replace(/\*\*|__|`/g, '')
        .replace(/\s+/g, ' ')
        .trim();

interface ToolPermissionRowProps {
    tool: McpTool;
    permission: ToolPermission;
    isOpen: boolean;
    onToggle: () => void;
    onChange: (value: ToolPermission) => void;
}

export const ToolPermissionRow = ({ tool, permission, isOpen, onToggle, onChange }: ToolPermissionRowProps) => {
    const description = tool.description ? cleanDescription(tool.description) : '';
    const isExpandable = description.length > SUMMARY_CLAMP_LENGTH;

    const renderLabel = () => (
        <>
            {isExpandable ? (
                <ChevronRight
                    className={cn(
                        'size-3.5 shrink-0 text-muted-foreground transition-transform',
                        isOpen && 'rotate-90',
                    )}
                    aria-hidden="true"
                />
            ) : (
                <span className="size-3.5 shrink-0" aria-hidden="true" />
            )}
            <span className="min-w-0 truncate font-mono text-sm font-semibold sm:shrink-0">{tool.name}</span>
            {description && !isOpen ? (
                <span className="hidden truncate text-sm text-muted-foreground sm:inline">{description}</span>
            ) : null}
        </>
    );

    return (
        <div
            data-tool={tool.name}
            className={cn(
                'collapsible-content-item grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-5 gap-y-1 py-3 pr-4 pl-9.5',
                'transition-colors hover:bg-muted/30',
            )}
        >
            {isExpandable ? (
                <button
                    type="button"
                    aria-expanded={isOpen}
                    onClick={onToggle}
                    className="flex min-w-0 cursor-pointer items-center gap-2.5 overflow-hidden text-left"
                >
                    {renderLabel()}
                </button>
            ) : (
                <div className="flex min-w-0 items-center gap-2.5 overflow-hidden">{renderLabel()}</div>
            )}
            <PermissionSwitch value={permission} onChange={onChange} />
            {isOpen && isExpandable ? (
                <p className="col-span-full my-1 ml-6 max-w-full text-sm leading-relaxed text-muted-foreground">
                    {description}
                </p>
            ) : null}
        </div>
    );
};
