import { useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

import CommandPalette from '@/app/components/command-palette/command-palette';
import useCanEditAgent from '@/app/hooks/use-can-edit-agent';
import useChatShortcuts from '@/app/hooks/use-chat-shortcuts';
import { useAgentComposerContext } from '@/components/agent-chat/context/agent-composer-context';
import { useChatShell } from '@/components/agent-chat/context/chat-shell-context';
import ShortcutsDialog from '@/components/keyboard-shortcuts/shortcuts-dialog';
import type { ChatAgentType } from '@/types/admin';

interface Props {
    agent: ChatAgentType;
}

const ChatKeyboardLayer = ({ agent }: Props) => {
    const navigate = useNavigate();
    const location = useLocation();
    const { composer } = useAgentComposerContext();
    const { isPreview } = useChatShell();
    const canEditAgent = useCanEditAgent(agent);

    const handleNewChat = useCallback(() => {
        if (agent.uiConfig?.home?.search?.isIncognitoEnabled && composer.isIncognitoMode) {
            composer.toggleIncognitoMode();
        }

        navigate(`/agent/${agent.slug}`);
    }, [agent, composer, navigate]);

    const isIncognitoAvailable = Boolean(agent.uiConfig?.home?.search?.isIncognitoEnabled);
    const isModelSelectorAvailable = composer.availableModels.length > 1;

    const handleIncognitoChat = useCallback(() => {
        const willBeIncognito = !composer.isIncognitoMode;

        composer.toggleIncognitoMode();

        if (willBeIncognito) {
            navigate(`/agent/${agent.slug}`);
        }
    }, [agent.slug, composer, navigate]);

    const handleOpenSettings = useCallback(() => {
        navigate('/settings/user', {
            state: { from: `${location.pathname}${location.search}` },
        });
    }, [navigate, location.pathname, location.search]);

    const handleUploadFile = useCallback(() => {
        composer.composerActionsRef.current?.openFilePicker?.();
    }, [composer.composerActionsRef]);

    const handleEditAgent = useCallback(() => {
        navigate(`/agent-builder/${agent._id}`, {
            state: { from: `${location.pathname}${location.search}` },
        });
    }, [agent._id, navigate, location.pathname, location.search]);

    const handleSelectModel = useCallback(() => {
        composer.composerActionsRef.current?.openModelSelector?.();
    }, [composer.composerActionsRef]);

    const { isShortcutsOpen, isPaletteOpen, setShortcutsOpen, setPaletteOpen } = useChatShortcuts({
        onNewChat: handleNewChat,
        onIncognitoChat: isIncognitoAvailable ? handleIncognitoChat : undefined,
        onOpenSettings: handleOpenSettings,
        onUploadFile: handleUploadFile,
        onSelectModel: isModelSelectorAvailable ? handleSelectModel : undefined,
        onEditAgent: canEditAgent && !isPreview ? handleEditAgent : undefined,
    });

    return (
        <>
            <ShortcutsDialog open={isShortcutsOpen} onOpenChange={setShortcutsOpen} />
            <CommandPalette
                agent={agent}
                open={isPaletteOpen}
                onOpenChange={setPaletteOpen}
                onNewChat={handleNewChat}
            />
        </>
    );
};

export default ChatKeyboardLayer;
