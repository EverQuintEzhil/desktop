'use client';

import { useScrollLock, type ToolCallMessagePartStatus, type ToolCallMessagePartProps } from '@assistant-ui/react';
import { Circle } from 'lucide-react';
import { memo, useCallback, useRef, useState, type ComponentType } from 'react';

import { highlightJson } from '@/components/assistant-ui/json-highlight';
import { formatToolName } from '@/components/assistant-ui/tool-label';
import { useIsMessageSettled } from '@/components/assistant-ui/use-is-message-settled';
import { RAIL_ITEM_CLASS } from '@/components/chat/tools';
import CopyButton from '@/components/copy-button/copy-button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { cn } from '@/lib/utils';

const ANIMATION_DURATION = 200;

type ToolFallbackRootProps = Omit<React.ComponentProps<typeof Collapsible>, 'open' | 'onOpenChange'> & {
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    defaultOpen?: boolean;
};

function ToolFallbackRoot({
    className,
    open: controlledOpen,
    onOpenChange: controlledOnOpenChange,
    defaultOpen = false,
    children,
    ...props
}: ToolFallbackRootProps) {
    const collapsibleRef = useRef<HTMLDivElement>(null);
    const [uncontrolledOpen, setUncontrolledOpen] = useState(defaultOpen);
    const lockScroll = useScrollLock(collapsibleRef, ANIMATION_DURATION);

    const isControlled = controlledOpen !== undefined;
    const isOpen = isControlled ? controlledOpen : uncontrolledOpen;

    const handleOpenChange = useCallback(
        (open: boolean) => {
            if (!open) {
                lockScroll();
            }
            if (!isControlled) {
                setUncontrolledOpen(open);
            }
            controlledOnOpenChange?.(open);
        },
        [lockScroll, isControlled, controlledOnOpenChange],
    );

    return (
        <Collapsible
            ref={collapsibleRef}
            data-slot="tool-fallback-root"
            open={isOpen}
            onOpenChange={handleOpenChange}
            className={cn(
                'aui-tool-fallback-root group/tool-fallback-root',
                'animate-in duration-(--animation-duration) fade-in-0 motion-reduce:animate-none',
                RAIL_ITEM_CLASS,
                className,
            )}
            style={
                {
                    '--animation-duration': `${ANIMATION_DURATION}ms`,
                } as React.CSSProperties
            }
            {...props}
        >
            {children}
        </Collapsible>
    );
}

function ToolFallbackRailNode({
    faviconUrl,
    statusType,
    isRunning,
    isCancelled,
}: {
    faviconUrl?: string;
    statusType: string;
    isRunning: boolean;
    isCancelled: boolean;
}) {
    const [faviconFailed, setFaviconFailed] = useState(false);
    const showFavicon = faviconUrl != null && faviconUrl !== '' && !faviconFailed;

    if (showFavicon) {
        return (
            <div
                data-slot="tool-fallback-trigger-node"
                className="aui-tool-fallback-trigger-node absolute left-[-26px] flex size-5 shrink-0 items-center justify-center overflow-hidden rounded-full bg-background"
            >
                <img
                    src={faviconUrl}
                    alt=""
                    aria-hidden
                    className="aui-tool-fallback-trigger-favicon size-4 rounded-full object-contain"
                    onError={() => setFaviconFailed(true)}
                />
            </div>
        );
    }

    return (
        <div
            data-slot="tool-fallback-trigger-node"
            className={cn(
                'aui-tool-fallback-trigger-node absolute left-[-26px] flex size-5 shrink-0 items-center justify-center rounded-full bg-background',
                statusType === 'complete' && 'text-primary',
                isRunning && 'text-primary',
                (isCancelled || statusType === 'incomplete' || statusType === 'requires-action') &&
                    'text-muted-foreground',
            )}
        >
            <Circle
                data-slot="tool-fallback-trigger-dot"
                className={cn('size-4', isRunning && 'animate-tool-circle-fill')}
                aria-hidden="true"
            />
        </div>
    );
}

function ToolFallbackHeader({
    toolName,
    status,
    title: titleProp,
    hasContent,
    faviconUrl,
    className,
}: {
    toolName: string;
    status?: ToolCallMessagePartStatus;
    title?: string;
    hasContent: boolean;
    faviconUrl?: string;
    className?: string;
}) {
    const statusType = status?.type ?? 'complete';
    const isRunning = statusType === 'running';
    const isCancelled = status?.type === 'incomplete' && status.reason === 'cancelled';

    const title = titleProp ?? formatToolName(toolName);

    const rowClassName = cn(
        'aui-tool-fallback-header group/trigger flex w-full items-center gap-2 text-sm text-muted-foreground',
        className,
    );

    const rowContent = (
        <>
            <ToolFallbackRailNode
                faviconUrl={faviconUrl}
                statusType={statusType}
                isRunning={isRunning}
                isCancelled={Boolean(isCancelled)}
            />
            <span
                data-slot="tool-fallback-trigger-label"
                className={cn(
                    'aui-tool-fallback-trigger-label-wrapper relative mt-[-2px] mr-auto inline-block leading-none',
                    isCancelled && 'text-muted-foreground line-through',
                )}
            >
                <span className={cn(isRunning && 'shimmer motion-reduce:animate-none')}>{title}</span>
            </span>
        </>
    );

    if (!hasContent) {
        return (
            <div data-slot="tool-fallback-header" className={rowClassName}>
                {rowContent}
            </div>
        );
    }

    return (
        <CollapsibleTrigger asChild>
            <button
                type="button"
                data-slot="tool-fallback-header"
                className={cn(
                    rowClassName,
                    'cursor-pointer text-left transition-colors hover:text-foreground motion-reduce:transition-none',
                    'outline-none focus-visible:ring-1 focus-visible:ring-(--color-focus-ring)',
                )}
            >
                {rowContent}
            </button>
        </CollapsibleTrigger>
    );
}

function ToolFallbackResultToggle({ className, ...props }: React.ComponentProps<typeof CollapsibleTrigger>) {
    return (
        <CollapsibleTrigger asChild>
            <button
                type="button"
                data-slot="tool-fallback-result-toggle"
                className={cn(
                    'aui-tool-fallback-result-toggle mt-3 inline-flex w-fit cursor-pointer items-center rounded-md bg-card px-2 py-0.5 text-xs font-medium text-muted-foreground',
                    'transition-colors hover:bg-muted/80 hover:text-foreground motion-reduce:transition-none',
                    'data-[state=open]:bg-muted/80 data-[state=open]:text-foreground',
                    'outline-none focus-visible:ring-1 focus-visible:ring-(--color-focus-ring)',
                    className,
                )}
                {...props}
            >
                Result
            </button>
        </CollapsibleTrigger>
    );
}

function ToolFallbackContent({ className, children, ...props }: React.ComponentProps<typeof CollapsibleContent>) {
    return (
        <CollapsibleContent
            data-slot="tool-fallback-content"
            className={cn(
                'aui-tool-fallback-content relative overflow-hidden text-sm outline-none',
                'group/collapsible-content ease-out',
                'data-[state=closed]:animate-collapsible-up',
                'data-[state=open]:animate-collapsible-down',
                'data-[state=closed]:fill-mode-forwards',
                'data-[state=closed]:pointer-events-none',
                'data-[state=open]:duration-(--animation-duration)',
                'data-[state=closed]:duration-(--animation-duration)',
                className,
            )}
            {...props}
        >
            <div className="scrollbar-controller scrollbar-vertical mt-2 flex max-h-[200px] flex-col gap-2 rounded-md bg-card p-2">
                {children}
            </div>
        </CollapsibleContent>
    );
}

function ToolFallbackCard({
    label,
    value,
    highlight = false,
    className,
    ...props
}: Omit<React.ComponentProps<'div'>, 'children'> & {
    label: string;
    value: string;
    highlight?: boolean;
}) {
    return (
        <div
            data-slot="tool-fallback-card"
            className={cn(
                'aui-tool-fallback-card group/tool-card relative rounded-lg bg-muted/50 px-3 py-2.5',
                className,
            )}
            {...props}
        >
            <div
                data-slot="tool-fallback-card-copy"
                className={cn(
                    'aui-tool-fallback-card-copy absolute top-1.5 right-1.5',
                    'opacity-0 transition-opacity',
                    'group-focus-within/tool-card:opacity-100 group-hover/tool-card:opacity-100',
                    'motion-reduce:transition-none',
                )}
            >
                <CopyButton text={value} tooltipContent="Copy" tooltipSide="top" />
            </div>
            <p
                data-slot="tool-fallback-card-label"
                className="aui-tool-fallback-card-label mb-1.5 text-xs font-semibold text-foreground"
            >
                {label}
            </p>
            <pre className="aui-tool-fallback-card-content scrollbar-controller scrollbar-horizontal font-mono text-xs leading-relaxed wrap-break-word whitespace-pre-wrap text-foreground">
                {highlight ? highlightJson(value) : value}
            </pre>
        </div>
    );
}

function ToolFallbackArgs({ argsText, className }: { argsText?: string; className?: string }) {
    if (!argsText) return null;

    let displayText = argsText;
    let isJson = false;

    try {
        const parsed = JSON.parse(argsText);

        displayText = JSON.stringify(parsed, null, 2);
        isJson = true;
    } catch {
        displayText = argsText;
    }

    return (
        <ToolFallbackCard
            label="Request"
            value={displayText}
            highlight={isJson}
            className={className}
            data-slot="tool-fallback-args"
        />
    );
}

function ToolFallbackResult({ result }: { result?: unknown }) {
    if (result === undefined) return null;

    const isJson = typeof result !== 'string';
    const text = isJson ? JSON.stringify(result, null, 2) : (result as string);

    return <ToolFallbackCard label="Response" value={text} highlight={isJson} data-slot="tool-fallback-result" />;
}

function ToolFallbackError({ status }: { status?: ToolCallMessagePartStatus }) {
    if (status?.type !== 'incomplete') return null;

    const error = status.error;
    const errorText = error ? (typeof error === 'string' ? error : JSON.stringify(error)) : null;

    if (!errorText) return null;

    const isCancelled = status.reason === 'cancelled';
    const headerText = isCancelled ? 'Cancelled reason' : 'Error';

    return (
        <div data-slot="tool-fallback-error" className="aui-tool-fallback-error flex flex-col gap-1">
            <p className="aui-tool-fallback-error-header text-xs font-semibold text-muted-foreground">{headerText}</p>
            <p className="aui-tool-fallback-error-reason text-muted-foreground">{errorText}</p>
        </div>
    );
}

type ToolFallbackProps = ToolCallMessagePartProps & { title?: string; faviconUrl?: string };

const ToolFallbackImpl = ({ toolCallId, toolName, argsText, result, status, title, faviconUrl }: ToolFallbackProps) => {
    const isCancelled = status?.type === 'incomplete' && status.reason === 'cancelled';
    const isMessageSettled = useIsMessageSettled();

    const hasContent = (argsText != null && argsText !== '') || result !== undefined;

    return (
        <ToolFallbackRoot
            key={`${toolCallId}-${isMessageSettled ? 'settled' : 'running'}`}
            data-slot="tool-fallback-step"
        >
            <ToolFallbackHeader
                toolName={toolName}
                status={status}
                title={title}
                hasContent={hasContent}
                faviconUrl={faviconUrl}
            />
            {hasContent && (
                <>
                    <ToolFallbackResultToggle />
                    <ToolFallbackContent>
                        <ToolFallbackError status={status} />
                        <ToolFallbackArgs argsText={argsText} className={cn(isCancelled && 'opacity-60')} />
                        {!isCancelled && <ToolFallbackResult result={result} />}
                    </ToolFallbackContent>
                </>
            )}
        </ToolFallbackRoot>
    );
};

const ToolFallback = memo(ToolFallbackImpl) as ComponentType<ToolFallbackProps>;

ToolFallback.displayName = 'ToolFallback';

export { ToolFallback };
