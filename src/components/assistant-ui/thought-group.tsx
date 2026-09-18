'use client';

import { Circle } from 'lucide-react';
import { createContext, useContext, useRef, type ReactNode } from 'react';

import { formatElapsed } from '@/components/assistant-ui/format-elapsed';
import {
    ToolGroupContent,
    ToolGroupDone,
    ToolGroupRoot,
    ToolGroupTrigger,
    ToolRailItem,
} from '@/components/assistant-ui/tool-group';
import { useReasoningElapsed } from '@/components/assistant-ui/use-reasoning-elapsed';
import { ToolRailNode } from '@/components/chat/tools';

/** Below this a reported total is noise, and a rounded "Thought for 0s" reads as a bug. */
const MIN_REPORTABLE_MS = 1_000;

const ThoughtGroupContext = createContext(false);

/** True while a reasoning or tool subgroup renders inside a thought group. The thought group owns
 * the single collapsible and the single rail, so a nested subgroup must not open a second of either. */
export const useIsInsideThoughtGroup = () => useContext(ThoughtGroupContext);

interface ThoughtGroupProps {
    startIndex: number;
    endIndex: number;
    hasReasoning: boolean;
    hasTools: boolean;
    ownsAllReasoning: boolean;
    allToolsTimed: boolean;
    toolLabel: string;
    toolDurationMs?: number;
    active: boolean;
    done: boolean;
    defaultOpen: boolean;
    forceOpen: boolean;
    settleKey: string;
    children: ReactNode;
}

export const ThoughtGroup = ({
    startIndex,
    endIndex,
    hasReasoning,
    hasTools,
    ownsAllReasoning,
    allToolsTimed,
    toolLabel,
    toolDurationMs,
    active,
    done,
    defaultOpen,
    forceOpen,
    settleKey,
    children,
}: ThoughtGroupProps) => {
    const { isStreaming: isReasoningStreaming, elapsedMs: reasoningMs } = useReasoningElapsed(
        startIndex,
        endIndex,
        ownsAllReasoning,
    );

    // The header reports one span for the whole panel — thinking plus the tools it ran — and only
    // when every component of it is known. A tool that emits no progress contributes nothing to the
    // sum, so a panel that searched for twenty seconds would otherwise announce its 1s of thinking
    // as the whole run. Naming what the panel did beats a number we know to be wrong.
    const summedMs = (reasoningMs ?? 0) + (toolDurationMs ?? 0);
    const isSpanKnown = (!hasReasoning || reasoningMs !== undefined) && (!hasTools || allToolsTimed);
    const totalMs = isSpanKnown && summedMs >= MIN_REPORTABLE_MS ? summedMs : undefined;

    // A panel that never called a tool must not borrow the tool vocabulary, in either phase.
    // "Worked for" once tool time is inside the number, "Thought for" only when it is pure
    // thinking — the distinction Grok draws, and the one that stops a mostly-searching run
    // from being reported as thinking.
    const resolveLabel = (): string => {
        if (isReasoningStreaming) return 'Thinking…';
        if (active) return hasTools ? toolLabel : 'Thinking…';
        if (totalMs === undefined) return hasTools ? toolLabel : 'Reasoning';
        if (!hasReasoning) return toolLabel;

        const verb = hasTools ? 'Worked' : 'Thought';

        return `${verb} for ${formatElapsed(totalMs)}`;
    };

    // The suffix carries the same sum, so it has to obey the same rule: never show a tool time that
    // only covers some of the tools, and never repeat one already folded into the header total.
    const showToolDuration = !active && allToolsTimed && !(hasReasoning && totalMs !== undefined);

    // Live thinking stays visible for the whole run, the way the standalone reasoning block did.
    // Gating on "reasoning is the last part" would hide it the moment a tool started.
    const isThinkingVisible = hasReasoning && active;

    // Re-asserting the force-open on every reasoning burst would keep reopening a panel the reader
    // deliberately closed, so the close is latched for the life of the message.
    const readerClosedRef = useRef(false);

    return (
        <ThoughtGroupContext.Provider value={true}>
            {/* Only the collapsible remounts on settle, so it re-collapses without discarding the
                live reasoning timer that `useReasoningElapsed` holds above it. */}
            <ToolGroupRoot
                key={settleKey}
                // Open on the first paint when it should already be open, so a streaming thinking
                // panel does not render collapsed for a frame before the effect expands it.
                defaultOpen={defaultOpen || isThinkingVisible}
                onOpenChange={(open) => {
                    if (!open) {
                        readerClosedRef.current = true;
                    }
                }}
                // `defaultOpen` is read once, so it cannot open a group that mounted before its
                // reasoning arrived — this covers reasoning that starts after a tool call.
                forceOpen={forceOpen || (isThinkingVisible && !readerClosedRef.current)}
            >
                <ToolGroupTrigger
                    active={active}
                    label={resolveLabel()}
                    elapsedMs={showToolDuration ? toolDurationMs : undefined}
                />
                <ToolGroupContent>
                    {children}
                    {done && <ToolGroupDone />}
                </ToolGroupContent>
            </ToolGroupRoot>
        </ThoughtGroupContext.Provider>
    );
};

export const ThoughtReasoningStep = ({ children }: { children: ReactNode }) => (
    <ToolRailItem data-slot="thought-reasoning-step" className="aui-thought-reasoning-step">
        <ToolRailNode tone="muted" dataSlot="thought-reasoning-step-node" className="top-0.5">
            <Circle className="size-4" aria-hidden="true" />
        </ToolRailNode>
        <div className="aui-thought-reasoning-step-text scrollbar-controller scrollbar-vertical max-h-64 space-y-4 text-sm leading-relaxed text-muted-foreground">
            {children}
        </div>
    </ToolRailItem>
);
