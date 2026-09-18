import type { ChatAgentUiType } from '@/types/ui';

import { buildDefaultUiConfig } from '../../../lib/create-agent-api';

export const restoreModel = (current?: ChatAgentUiType, published?: ChatAgentUiType): ChatAgentUiType => {
    const base = published ?? buildDefaultUiConfig();

    if (!current) {
        return base;
    }

    const rest: ChatAgentUiType = { ...current };

    delete rest.defaultModel;
    delete rest.models;

    return {
        ...rest,
        models: base.models ?? [],
        ...(base.defaultModel ? { defaultModel: base.defaultModel } : {}),
    };
};

export const restoreAppearance = (current?: ChatAgentUiType, published?: ChatAgentUiType): ChatAgentUiType => {
    const base = published ?? buildDefaultUiConfig();
    const currentModel = current?.defaultModel;

    return {
        ...base,
        models: current?.models ?? base.models ?? [],
        ...(currentModel ? { defaultModel: currentModel } : {}),
    };
};
