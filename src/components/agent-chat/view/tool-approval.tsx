import type { ToolCallMessagePart, ToolCallMessagePartProps } from '@assistant-ui/react';
import { Ban, ChevronDown, Circle, CircleCheck, CornerDownLeft, ShieldQuestion } from 'lucide-react';
import { useEffect, useRef, useState, type ReactNode } from 'react';

import { formatToolName } from '@/components/assistant-ui/tool-label';
import { ChatBlock } from '@/components/chat/blocks';
import { RAIL_ITEM_CLASS, ToolRailNode } from '@/components/chat/tools';
import { Button } from '@/components/ui/button';
import {
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuRoot,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { buildConnectorFaviconUrl } from '@/lib/chat/connector-favicon';
import { cn } from '@/lib/utils';

import { useToolApproval } from '../context/tool-approval-context';

const APPROVED_RESULT = 'Approved by user';
const DENIED_RESULT = 'User denied tool execution';

export const getMcpServerId = (toolName: string): string | undefined => toolName.match(/^mcp_([^_]+)_/)?.[1];

export const buildMcpFaviconUrl = (serverUrl: string): string | undefined => buildConnectorFaviconUrl(serverUrl, 32);

type HintLabel = 'enter' | 'cmd-enter' | 'esc';
type ApprovalStepState = 'pending' | 'approved' | 'denied';

interface ToolApprovalProps {
    toolCallId: string;
    toolName: string;
    faviconUrl?: string;
    approval?: ToolCallMessagePart['approval'];
    interrupt?: ToolCallMessagePart['interrupt'];
    respondToApproval?: ToolCallMessagePartProps['respondToApproval'];
    resume?: ToolCallMessagePartProps['resume'];
    addResult?: ToolCallMessagePartProps['addResult'];
}

const TOOL_APPROVAL_STEP_CLASS = cn('tool-approval-step', RAIL_ITEM_CLASS);

const ToolApprovalStep = ({ state, children }: { state: ApprovalStepState; children: ReactNode }) => {
    const renderNode = () => {
        if (state === 'approved') return <CircleCheck className="size-4" aria-hidden="true" />;
        if (state === 'denied') return <Ban className="size-4" aria-hidden="true" />;

        return <Circle className="animate-tool-circle-fill size-4" aria-hidden="true" />;
    };

    return (
        <div className={TOOL_APPROVAL_STEP_CLASS}>
            <ToolRailNode
                tone={state === 'denied' ? 'muted' : 'active'}
                dataSlot="tool-approval-step-node"
                className="top-1"
            >
                {renderNode()}
            </ToolRailNode>
            {children}
        </div>
    );
};

const isEditableTarget = (target: EventTarget | null): boolean => {
    if (!(target instanceof HTMLElement)) return false;

    const tagName = target.tagName;

    return tagName === 'INPUT' || tagName === 'TEXTAREA' || target.isContentEditable;
};

const ToolApprovalPending = ({
    toolCallId,
    toolName,
    faviconUrl,
    approval,
    interrupt,
    respondToApproval,
    resume,
    addResult,
}: ToolApprovalProps) => {
    const { isAlwaysAllowed, addAlwaysAllowed, register, unregister, isActive } = useToolApproval();
    const [submitted, setSubmitted] = useState(false);
    const [isMenuOpen, setIsMenuOpen] = useState(false);
    const [faviconFailed, setFaviconFailed] = useState(false);
    const autoApprovedRef = useRef(false);
    const isActiveNow = isActive(toolCallId);

    const respond = (approved: boolean) => {
        if (submitted) return;
        setSubmitted(true);
        if (approval && approval.approved === undefined && respondToApproval) {
            respondToApproval({ approved });
        } else if (interrupt) {
            resume?.({ approved });
        } else {
            addResult?.(approved ? APPROVED_RESULT : DENIED_RESULT);
        }
    };

    const handleAlwaysAllow = () => {
        addAlwaysAllowed(toolName);
        respond(true);
    };

    const handleAllowOnce = () => {
        respond(true);
    };

    const handleDeny = () => {
        respond(false);
    };

    const isPreApproved = isAlwaysAllowed(toolName);

    useEffect(() => {
        if (isPreApproved) return undefined;

        register(toolCallId);

        return () => unregister(toolCallId);
    }, [register, unregister, toolCallId, isPreApproved]);

    const latest = useRef({
        submitted,
        isMenuOpen,
        isActiveNow,
        handleAlwaysAllow,
        handleAllowOnce,
        handleDeny,
    });

    latest.current = {
        submitted,
        isMenuOpen,
        isActiveNow,
        handleAlwaysAllow,
        handleAllowOnce,
        handleDeny,
    };

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            const current = latest.current;

            if (!current.isActiveNow || current.submitted || current.isMenuOpen) return;
            if (isEditableTarget(event.target)) return;

            if (event.key === 'Enter') {
                event.preventDefault();
                if (event.metaKey || event.ctrlKey) {
                    current.handleAllowOnce();
                } else {
                    current.handleAlwaysAllow();
                }
            } else if (event.key === 'Escape') {
                event.preventDefault();
                current.handleDeny();
            }
        };

        window.addEventListener('keydown', handleKeyDown);

        return () => window.removeEventListener('keydown', handleKeyDown);
    }, []);

    useEffect(() => {
        if (autoApprovedRef.current || submitted) return;
        if (approval?.approved !== undefined) return;
        if (!isAlwaysAllowed(toolName)) return;

        autoApprovedRef.current = true;
        respond(true);
    }, [approval?.approved, submitted, isAlwaysAllowed, toolName]);

    if (isPreApproved) return null;

    const renderHint = (label: HintLabel) => {
        if (!isActiveNow) return null;

        if (label === 'enter') {
            return <CornerDownLeft className="size-3.5" aria-hidden="true" />;
        }

        return <span className="ml-auto text-xs text-muted-foreground">{label === 'cmd-enter' ? '⌘↵' : 'Esc'}</span>;
    };

    return (
        <ToolApprovalStep state="pending">
            <ChatBlock dataSlot="tool-approval" className="tool-approval" bodyClassName="flex flex-col gap-4 p-4">
                <div className="tool-approval-header flex items-start gap-2">
                    <ShieldQuestion className="size-6 text-foreground" aria-hidden="true" />
                    <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium text-foreground">Allow this tool to run?</span>
                        <div className="flex items-center gap-2">
                            {faviconUrl && !faviconFailed ? (
                                <img
                                    src={faviconUrl}
                                    alt=""
                                    aria-hidden
                                    className="size-4 shrink-0 rounded-sm object-contain"
                                    onError={() => setFaviconFailed(true)}
                                />
                            ) : null}
                            <span className="text-sm text-muted-foreground">{formatToolName(toolName)}</span>
                        </div>
                    </div>
                </div>
                <div className="tool-approval-actions flex items-center gap-2 pl-8">
                    <div className="flex items-center">
                        <Button
                            size="sm"
                            className="gap-1.5 rounded-r-none"
                            onClick={handleAlwaysAllow}
                            disabled={submitted}
                        >
                            Always allow
                            {renderHint('enter')}
                        </Button>
                        <DropdownMenuRoot open={isMenuOpen} onOpenChange={setIsMenuOpen}>
                            <DropdownMenuTrigger asChild>
                                <Button
                                    size="sm"
                                    className="rounded-l-none border-l border-primary-foreground/20 px-2"
                                    disabled={submitted}
                                    aria-label="More approval options"
                                >
                                    <ChevronDown className="size-3.5" aria-hidden="true" />
                                </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                                <DropdownMenuItem onSelect={handleAllowOnce} disabled={submitted}>
                                    Allow once
                                    {renderHint('cmd-enter')}
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenuRoot>
                    </div>
                    <Button size="sm" variant="outline" className="gap-1.5" onClick={handleDeny} disabled={submitted}>
                        Deny
                        {renderHint('esc')}
                    </Button>
                </div>
            </ChatBlock>
        </ToolApprovalStep>
    );
};

const ToolApproval = (props: ToolApprovalProps) => {
    const { approval } = props;

    if (approval?.approved === true) {
        return (
            <ToolApprovalStep state="approved">
                <div className="flex items-center gap-2 pb-2 text-sm text-muted-foreground">
                    <CircleCheck className="size-4 text-primary" aria-hidden="true" />
                    <span>Tool approved</span>
                </div>
            </ToolApprovalStep>
        );
    }

    if (approval?.approved === false) {
        return (
            <ToolApprovalStep state="denied">
                <div className="flex items-center gap-2 pb-2 text-sm text-muted-foreground">
                    <Ban className="size-4 text-foreground" aria-hidden="true" />
                    <span>Tool denied</span>
                </div>
            </ToolApprovalStep>
        );
    }

    return <ToolApprovalPending {...props} />;
};

export default ToolApproval;
