import { BotIcon, MessageCircleIcon } from 'lucide-react';

// eslint-disable-next-line max-len -- deep admin module path cannot be wrapped
import GalleryPromptInputPreview from '@/admin/screens/private/screens/admin/components/agents/components/agent-detail/components/agent-ui-config-editor/components/preview/gallery-prompt-input-preview';
import type { ChatUiConfig } from '@/admin/screens/private/screens/admin/components/agents/components/agent-detail/components/agent-ui-config-editor/schema';

export type ChatPreviewValue = ChatUiConfig;

interface ChatPreviewProps {
    value: ChatPreviewValue;
    agentName?: string;
}

const ChatPreview = ({ value, agentName }: ChatPreviewProps) => {
    const title = value.home.title || 'What can I help you with?';
    const incognitoTitle = value.home.titleIncognito || 'You are in Temporary chat mode';
    const placeholder = value.home.search?.placeholder || 'Ask anything';
    const questions = value.home.questions?.filter(Boolean).slice(0, 4) ?? [];
    const showIncognito = value.home.search?.isIncognitoEnabled ?? false;

    const renderIncognitoTitle = () => {
        if (!showIncognito) return null;

        return <p className="text-xs text-text-secondary">{incognitoTitle}</p>;
    };

    const renderIncognitoButton = () => {
        if (!showIncognito) return null;

        return (
            <div className="absolute top-3 right-4 flex size-9 items-center justify-center rounded-full bg-card shadow-sm">
                <MessageCircleIcon className="size-4 text-primary" />
            </div>
        );
    };

    const renderQuestions = () => {
        if (questions.length === 0) return null;

        return (
            <div className="grid grid-cols-1 gap-2 @[340px]:grid-cols-2">
                {questions.map((question) => (
                    <div
                        key={question}
                        className="line-clamp-2 rounded-full border border-primary px-3 py-2 text-xs font-medium text-primary"
                    >
                        {question}
                    </div>
                ))}
            </div>
        );
    };

    return (
        <div className="@container relative flex h-full min-h-0 flex-col overflow-hidden bg-background">
            <div className="absolute top-3 right-16 left-4 flex items-center gap-2">
                <div className="flex size-7 shrink-0 items-center justify-center rounded-full bg-card shadow-sm">
                    <BotIcon className="size-3.5 text-primary" />
                </div>
                <span className="max-w-[260px] min-w-0 text-sm leading-snug font-bold wrap-break-word whitespace-normal">
                    {agentName || 'Agent name'}
                </span>
            </div>
            {renderIncognitoButton()}
            <div className="mx-auto flex h-full w-full max-w-[810px] flex-col justify-center gap-10 px-5 py-24">
                <div className="space-y-2 text-center">
                    <h2 className="text-2xl font-medium">{title}</h2>
                    {renderIncognitoTitle()}
                </div>
                <GalleryPromptInputPreview value={value} promptPlaceholder={placeholder} />
                {renderQuestions()}
            </div>
            <div className="absolute right-0 bottom-3 left-0 text-center text-[11px] text-text-secondary">
                FluentMind
            </div>
        </div>
    );
};

export default ChatPreview;
