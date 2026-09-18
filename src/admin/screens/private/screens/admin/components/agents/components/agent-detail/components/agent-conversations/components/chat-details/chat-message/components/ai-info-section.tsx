import { ChevronRightIcon } from 'lucide-react';

import {
    Co2TokenUnit,
    TokenCountWithPercent,
    formatTokenValue,
    getTokenPercent,
    getTokenValue,
} from '@/admin/components/chat-message-shared';
import { CopyButton } from '@/components';

import type { AdminConversationMessage } from '../../chat-details';

export interface AiInfoSectionProps {
    aiInfo: AdminConversationMessage['ai_info'];
    // Owned by the parent message row: this component unmounts when the row collapses,
    // so local state would reset the disclosure on every collapse.
    isExpanded: boolean;
    onToggleExpanded: () => void;
}

interface TokenUsageRow {
    input: number | null;
    cachedInput: number | null;
    cacheWriteInput: number | null;
    hasCachedInput: boolean;
    reasoning: number | null;
    hasReasoning: boolean;
    nonReasoningOutput: number | null;
    total: number | null;
}

export const AiInfoSection = ({ aiInfo, isExpanded, onToggleExpanded }: AiInfoSectionProps) => {
    if (!aiInfo) return null;

    const { token_usage } = aiInfo;
    const inputTokens = getTokenValue(token_usage?.input_tokens);
    const cachedInputTokens = getTokenValue(token_usage?.cached_input_tokens);
    const cacheWriteInputTokens = getTokenValue(token_usage?.cache_write_input_tokens);
    const outputTokens = getTokenValue(token_usage?.output_tokens);
    const reasoningTokens = getTokenValue(token_usage?.reasoning_tokens);
    const totalTokens = getTokenValue(token_usage?.total_tokens);
    const inputTokensCo2 = getTokenValue(token_usage?.input_tokens_co2);
    const cachedInputTokensCo2 = getTokenValue(token_usage?.cached_input_tokens_co2);
    const cacheWriteInputTokensCo2 = getTokenValue(token_usage?.cache_write_input_tokens_co2);
    const outputTokensCo2 = getTokenValue(token_usage?.output_tokens_co2);
    const reasoningTokensCo2 = getTokenValue(token_usage?.reasoning_tokens_co2);
    const totalTokensCo2 = getTokenValue(token_usage?.total_tokens_co2);
    const co2MultiplierPerToken = getTokenValue(token_usage?.co2_multiplier_per_token);
    const totalTokenLabel = formatTokenValue(totalTokens);
    const totalCo2TokenLabel = formatTokenValue(totalTokensCo2);
    const hasReasoningTokens = reasoningTokens !== null && reasoningTokens > 0;
    const hasReasoningTokensCo2 = reasoningTokensCo2 !== null && reasoningTokensCo2 > 0;
    const nonReasoningOutput =
        outputTokens === null ? null : Math.max(0, outputTokens - (hasReasoningTokens ? reasoningTokens : 0));
    const nonReasoningOutputCo2 =
        outputTokensCo2 === null
            ? null
            : Math.max(0, outputTokensCo2 - (hasReasoningTokensCo2 ? reasoningTokensCo2 : 0));
    const hasCachedInputTokens =
        (cachedInputTokens !== null && cachedInputTokens > 0) ||
        (cacheWriteInputTokens !== null && cacheWriteInputTokens > 0);
    const hasCachedInputTokensCo2 =
        (cachedInputTokensCo2 !== null && cachedInputTokensCo2 > 0) ||
        (cacheWriteInputTokensCo2 !== null && cacheWriteInputTokensCo2 > 0);
    const nonCachedInput =
        inputTokens === null
            ? null
            : Math.max(0, inputTokens - (cachedInputTokens ?? 0) - (cacheWriteInputTokens ?? 0));
    const nonCachedInputCo2 =
        inputTokensCo2 === null
            ? null
            : Math.max(0, inputTokensCo2 - (cachedInputTokensCo2 ?? 0) - (cacheWriteInputTokensCo2 ?? 0));

    const renderTokenSegment = () => {
        if (!totalTokenLabel) return null;

        return (
            <>
                {' · '}
                {totalTokenLabel}
                {' tokens'}
            </>
        );
    };

    const renderCo2Segment = () => {
        if (!totalCo2TokenLabel) return null;

        return (
            <>
                {' · '}
                {totalCo2TokenLabel}
                <Co2TokenUnit />
            </>
        );
    };

    const renderAiInfoSummary = () => {
        if (!totalTokenLabel && !totalCo2TokenLabel) return aiInfo.model;

        return (
            <>
                {aiInfo.model}
                {renderTokenSegment()}
                {renderCo2Segment()}
            </>
        );
    };

    const renderTokenUsageGrid = (label: string, rows: TokenUsageRow, showCo2Unit = false) => {
        const {
            input,
            cachedInput,
            cacheWriteInput,
            hasCachedInput,
            reasoning,
            hasReasoning,
            nonReasoningOutput: output,
            total,
        } = rows;
        const hasVisibleUsage =
            input !== null ||
            output !== null ||
            hasReasoning ||
            total !== null ||
            cachedInput !== null ||
            cacheWriteInput !== null;

        const getRowPercent = (value: number) => {
            if (showCo2Unit) return null;

            return getTokenPercent(value, total);
        };

        if (!hasVisibleUsage) return null;

        return (
            <div className="flex flex-col gap-1.5">
                <span className="text-xs font-medium text-text-secondary">{label}</span>
                <div className="grid grid-cols-[auto_1fr_auto] items-center gap-x-3 gap-y-1">
                    {input !== null && (
                        <>
                            <span className="inline-block size-2 shrink-0 rounded-sm bg-blue-400/70" />
                            <span className="text-xs text-text-secondary">
                                {hasCachedInput ? 'Input (excl. cached)' : 'Input'}
                            </span>
                            <TokenCountWithPercent
                                value={input}
                                percent={getRowPercent(input)}
                                showCo2Unit={showCo2Unit}
                            />
                        </>
                    )}

                    {cachedInput !== null && cachedInput > 0 && (
                        <>
                            <span className="inline-block size-2 shrink-0 rounded-sm bg-sky-400/70" />
                            <span className="text-xs text-text-secondary">Cached input</span>
                            <TokenCountWithPercent
                                value={cachedInput}
                                percent={getRowPercent(cachedInput)}
                                showCo2Unit={showCo2Unit}
                            />
                        </>
                    )}

                    {cacheWriteInput !== null && cacheWriteInput > 0 && (
                        <>
                            <span className="inline-block size-2 shrink-0 rounded-sm bg-violet-400/70" />
                            <span className="text-xs text-text-secondary">Cache write</span>
                            <TokenCountWithPercent
                                value={cacheWriteInput}
                                percent={getRowPercent(cacheWriteInput)}
                                showCo2Unit={showCo2Unit}
                            />
                        </>
                    )}

                    {hasReasoning && reasoning !== null && (
                        <>
                            <span className="inline-block size-2 shrink-0 rounded-sm bg-amber-400/80" />
                            <span className="text-xs text-text-secondary">Reasoning</span>
                            <TokenCountWithPercent
                                value={reasoning}
                                percent={getRowPercent(reasoning)}
                                showCo2Unit={showCo2Unit}
                            />
                        </>
                    )}

                    {output !== null && (
                        <>
                            <span className="inline-block size-2 shrink-0 rounded-sm bg-primary" />
                            <span className="text-xs text-text-secondary">
                                {hasReasoning ? 'Output (excl. reasoning)' : 'Output'}
                            </span>
                            <TokenCountWithPercent
                                value={output}
                                percent={getRowPercent(output)}
                                showCo2Unit={showCo2Unit}
                            />
                        </>
                    )}

                    {total !== null && (
                        <>
                            <span className="inline-block size-2 shrink-0 rounded-sm bg-foreground" />
                            <span className="text-xs font-medium">Total</span>
                            <span className="text-right text-xs font-semibold tabular-nums">
                                {total.toLocaleString()}
                                {showCo2Unit && <Co2TokenUnit />}
                            </span>
                        </>
                    )}
                </div>
            </div>
        );
    };

    const renderTokenUsage = () => {
        const tokenUsage = renderTokenUsageGrid('Token Usage', {
            input: hasCachedInputTokens ? nonCachedInput : inputTokens,
            cachedInput: cachedInputTokens,
            cacheWriteInput: cacheWriteInputTokens,
            hasCachedInput: hasCachedInputTokens,
            reasoning: reasoningTokens,
            hasReasoning: hasReasoningTokens,
            nonReasoningOutput,
            total: totalTokens,
        });
        const co2TokenUsage = renderTokenUsageGrid(
            'CO₂ Token Usage',
            {
                input: hasCachedInputTokensCo2 ? nonCachedInputCo2 : inputTokensCo2,
                cachedInput: cachedInputTokensCo2,
                cacheWriteInput: cacheWriteInputTokensCo2,
                hasCachedInput: hasCachedInputTokensCo2,
                reasoning: reasoningTokensCo2,
                hasReasoning: hasReasoningTokensCo2,
                nonReasoningOutput: nonReasoningOutputCo2,
                total: totalTokensCo2,
            },
            true,
        );

        if (!tokenUsage && !co2TokenUsage && co2MultiplierPerToken === null) return null;

        return (
            <div className="flex flex-col gap-3">
                {tokenUsage}
                {co2TokenUsage}
                {co2MultiplierPerToken !== null && (
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        <span className="text-xs text-text-secondary">kgCO₂e multiplier per token</span>
                        <span className="text-xs font-medium tabular-nums">
                            {co2MultiplierPerToken.toLocaleString()}
                        </span>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="tool-call-accordion each-row">
            <div
                className="tool-call-header flex w-full cursor-pointer items-center justify-between gap-2 rounded-md p-2 select-none"
                onClick={() => onToggleExpanded()}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onToggleExpanded();
                    }
                }}
            >
                <div className="flex items-center gap-3">
                    <ChevronRightIcon className={`tool-call-chevron ${isExpanded ? 'is-expanded' : ''} size-4`} />
                    <span className="text-xs font-medium">AI Info</span>
                    {!isExpanded && <span className="text-xs text-text-secondary">{renderAiInfoSummary()}</span>}
                </div>
                <CopyButton text={JSON.stringify(aiInfo, null, 2)} size="small" />
            </div>

            {isExpanded && (
                <div className="tool-call-content flex flex-col gap-3 py-2 pr-2 pl-[38px]">
                    <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                        <span className="text-xs text-text-secondary">Provider</span>
                        <span className="text-xs font-medium capitalize">{aiInfo.provider}</span>
                        <span className="text-xs text-text-secondary">Model</span>
                        <span className="text-xs font-medium break-all">{aiInfo.model}</span>
                    </div>

                    {renderTokenUsage()}
                </div>
            )}
        </div>
    );
};
