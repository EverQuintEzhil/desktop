import type { HistoryType } from '@/types/chat';

import type { TokenUsage } from './token-usage-dialog';

export const buildConversationUsage = (aiInfo?: HistoryType['ai_info']): TokenUsage | null => {
    const tokenUsage = aiInfo?.token_usage;

    if (!tokenUsage) {
        return null;
    }

    const totalTokens = tokenUsage.total_tokens ?? 0;

    if (totalTokens <= 0) {
        return null;
    }

    const totalTokensCo2 = tokenUsage.total_tokens_co2 ?? 0;

    // The envelope aggregate carries only summable figures — a per-model rate or multiplier
    // is not one, so it is absent here by design and has to be recovered from the sums.
    const co2MultiplierPerToken = tokenUsage.co2_multiplier_per_token ?? totalTokensCo2 / totalTokens;

    return {
        input_tokens: tokenUsage.input_tokens ?? 0,
        cached_input_tokens: tokenUsage.cached_input_tokens ?? 0,
        cache_write_input_tokens: tokenUsage.cache_write_input_tokens ?? 0,
        output_tokens: tokenUsage.output_tokens ?? 0,
        reasoning_tokens: tokenUsage.reasoning_tokens ?? 0,
        total_tokens: totalTokens,
        co2_multiplier_per_token: co2MultiplierPerToken,
        input_tokens_co2: tokenUsage.input_tokens_co2 ?? 0,
        cached_input_tokens_co2: tokenUsage.cached_input_tokens_co2 ?? 0,
        cache_write_input_tokens_co2: tokenUsage.cache_write_input_tokens_co2 ?? 0,
        reasoning_tokens_co2: tokenUsage.reasoning_tokens_co2 ?? 0,
        output_tokens_co2: tokenUsage.output_tokens_co2 ?? 0,
        total_tokens_co2: totalTokensCo2,
        input_tokens_cost: tokenUsage.input_tokens_cost ?? 0,
        cached_input_tokens_cost: tokenUsage.cached_input_tokens_cost ?? 0,
        cache_write_input_tokens_cost: tokenUsage.cache_write_input_tokens_cost ?? 0,
        reasoning_tokens_cost: tokenUsage.reasoning_tokens_cost ?? 0,
        output_tokens_cost: tokenUsage.output_tokens_cost ?? 0,
        total_tokens_cost: tokenUsage.total_tokens_cost ?? 0,
        input_cost_per_million_tokens: tokenUsage.input_cost_per_million_tokens ?? 0,
        cached_input_cost_per_million_tokens: tokenUsage.cached_input_cost_per_million_tokens ?? 0,
        cache_write_input_cost_per_million_tokens: tokenUsage.cache_write_input_cost_per_million_tokens ?? 0,
        reasoning_cost_per_million_tokens: tokenUsage.reasoning_cost_per_million_tokens ?? 0,
        output_cost_per_million_tokens: tokenUsage.output_cost_per_million_tokens ?? 0,
    };
};
