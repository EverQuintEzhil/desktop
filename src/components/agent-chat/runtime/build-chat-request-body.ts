import type {
    FluentMindChatRequestBody,
    McpServerArgument,
    ReasoningEffort,
    ReasoningOptions,
    ReasoningSummary,
    SkillArgument,
} from '@/components/agent-chat/types';
import type { DropDownValueObject } from '@/components/ui/dropdown-menu';
import type { ModelValueType } from '@/types/admin';
import type { FileType, ParameterValue } from '@/types/chat';

interface BuildChatRequestBodyOptions {
    agentIdentifier: string;
    conversationId: string | null;
    projectId?: string | null;
    trigger?: 'submit-message' | 'regenerate-message';
    parentMessageId?: string | null;
    clientMessageId?: string;
    modelIdOverride?: string;
    model: DropDownValueObject<ModelValueType> | null;
    parameters: Record<string, ParameterValue>;
    isWebSearchEnabled: boolean;
    isDeepSearchEnabled: boolean;
    isRelatedQuestionsEnabled: boolean;
    relatedQuestionsCount?: number;
    isIncognitoMode: boolean;
    isPublic: boolean;
    fileIds: string[];
    mcpServers?: McpServerArgument[];
    skills?: SkillArgument[];
    messageText?: string;
}

type ResolvedArguments = FluentMindChatRequestBody['arguments'];

const REASONING_EFFORTS = new Set<ReasoningEffort>(['none', 'low', 'medium', 'high', 'xhigh']);
const REASONING_SUMMARIES = new Set<ReasoningSummary>(['auto', 'concise', 'detailed']);
const DEFAULT_RELATED_QUESTIONS_COUNT = 3;

const resolveRelatedQuestionsCount = (count?: number): number => {
    if (count !== undefined && Number.isInteger(count) && count >= 1 && count <= 5) return count;

    return DEFAULT_RELATED_QUESTIONS_COUNT;
};

const resolveParameterValue = (value: ParameterValue): string | number | boolean => {
    if (typeof value === 'number' || typeof value === 'boolean' || typeof value === 'string') return value;

    return value.value || '';
};

function resolveParameters(parameters: Record<string, ParameterValue>): ResolvedArguments {
    const resolved: ResolvedArguments = {};
    const reasoning: ReasoningOptions = {};

    Object.entries(parameters).forEach(([key, value]) => {
        const parameterValue = resolveParameterValue(value);

        if (['reasoning', 'reasoning.effort', 'reasoningEffort'].includes(key) && typeof parameterValue === 'string') {
            if (REASONING_EFFORTS.has(parameterValue as ReasoningEffort)) {
                reasoning.effort = parameterValue as ReasoningEffort;
            }

            return;
        }

        if (['reasoning.summary', 'reasoningSummary'].includes(key) && typeof parameterValue === 'string') {
            if (REASONING_SUMMARIES.has(parameterValue as ReasoningSummary)) {
                reasoning.summary = parameterValue as ReasoningSummary;
            }

            return;
        }

        if (key === 'tools' && typeof parameterValue === 'string') {
            const tools = parameterValue
                .split(',')
                .map((tool) => tool.trim())
                .filter(Boolean);

            if (tools.length > 0) resolved.tools = tools;

            return;
        }

        resolved[key] = parameterValue;
    });

    if (Object.keys(reasoning).length > 0) resolved.reasoning = reasoning;

    return resolved;
}

export function buildChatRequestBody(options: BuildChatRequestBodyOptions): FluentMindChatRequestBody {
    const {
        agentIdentifier,
        conversationId,
        projectId,
        trigger,
        parentMessageId,
        clientMessageId,
        modelIdOverride,
        model,
        parameters,
        isWebSearchEnabled,
        isDeepSearchEnabled,
        isRelatedQuestionsEnabled,
        relatedQuestionsCount,
        isIncognitoMode,
        isPublic,
        fileIds,
        mcpServers,
        skills,
        messageText,
    } = options;

    const resolvedParams = resolveParameters(parameters);
    const modelId = modelIdOverride ?? model?.value?.modelId;

    return {
        agentIdOrIdentifier: agentIdentifier,
        conversationId: conversationId || null,
        // Only stamp the project when creating a new conversation; existing ones
        // already carry their project server-side.
        ...(projectId && !conversationId && { projectId }),
        ...(trigger && { trigger }),
        ...(parentMessageId !== undefined && { parentMessageId }),
        ...(clientMessageId && { clientMessageId }),
        ...(modelId && { modelId }),
        arguments: {
            ...(messageText && { message: messageText }),
            webSearch: isWebSearchEnabled,
            deepSearch: isDeepSearchEnabled,
            ...(isRelatedQuestionsEnabled && { relatedQuestions: resolveRelatedQuestionsCount(relatedQuestionsCount) }),
            ...(mcpServers && mcpServers.length > 0 && { mcpServers }),
            ...(skills && skills.length > 0 && { skills }),
            ...resolvedParams,
        },
        options: {
            stream: true,
            queue: false,
            incognito: isIncognitoMode,
            public: isPublic,
        },
        ...(fileIds.length > 0 && { fileIds }),
    };
}

export function getFileIds(files: FileType[]): string[] {
    return files.flatMap((f) => (f._id ? [f._id] : []));
}
