import { CirclePlusIcon, MessageSquareIcon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import useConversationHistory from '@/components/agent-chat/hooks/use-conversation-history';
import { Button } from '@/components/ui/button';
import {
    CommandDialog,
    CommandEmpty,
    CommandFooter,
    CommandGroup,
    CommandInput,
    CommandItem,
    CommandList,
} from '@/components/ui/command';
import { Kbd } from '@/components/ui/kbd';
import type { ChatAgentType } from '@/types/admin';
import { formatRelativeTime } from '@/utils/date';

const SEARCH_DEBOUNCE_MS = 300;

const useDebouncedValue = (value: string, delay: number): string => {
    const [debounced, setDebounced] = useState(value);

    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);

        return () => clearTimeout(timer);
    }, [value, delay]);

    return debounced;
};

interface Props {
    agent: ChatAgentType;
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onNewChat: () => void;
}

const CommandPalette = ({ agent, open, onOpenChange, onNewChat }: Props) => {
    const navigate = useNavigate();
    const [search, setSearch] = useState('');
    const debouncedSearch = useDebouncedValue(search, SEARCH_DEBOUNCE_MS);
    const { allHistories } = useConversationHistory(agent, {
        includeAll: true,
        search: debouncedSearch,
        enabled: open,
    });

    const handleOpenChange = (nextOpen: boolean) => {
        if (!nextOpen) {
            setSearch('');
        }
        onOpenChange(nextOpen);
    };

    const handleSelectConversation = (conversationId: string) => {
        handleOpenChange(false);
        navigate(`/agent/${agent.slug}/chat/${conversationId}`);
    };

    const handleNewChatSelect = () => {
        handleOpenChange(false);
        onNewChat();
    };

    const renderConversations = () => {
        if (allHistories.length === 0) {
            return null;
        }

        return (
            <CommandGroup heading="Recents" className="flex flex-col gap-2">
                {allHistories.map((history) => (
                    <CommandItem
                        key={history._id}
                        value={`${history.title} ${history._id}`}
                        onSelect={() => handleSelectConversation(history._id)}
                        className="mb-1 py-1.5!"
                    >
                        <MessageSquareIcon />
                        <span className="flex-1 truncate">{history.title}</span>
                        <span className="shrink-0 text-xs text-muted-foreground">
                            {formatRelativeTime(history.updated_at, false)}
                        </span>
                    </CommandItem>
                ))}
            </CommandGroup>
        );
    };

    const renderCloseButton = () => {
        return (
            <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label="Close"
                onClick={() => handleOpenChange(false)}
            >
                <XIcon />
            </Button>
        );
    };

    return (
        <CommandDialog
            open={open}
            onOpenChange={handleOpenChange}
            shouldFilter={false}
            title="Command palette"
            description="Search chats and run quick actions"
            className="max-w-2xl"
        >
            <CommandInput
                placeholder="Search or start a chat"
                value={search}
                onValueChange={setSearch}
                trailing={renderCloseButton()}
                wrapperClassName="shrink-0 flex h-12 items-center gap-2 border-b border-border px-3 bg-popover"
            />
            <CommandList className="scrollbar-controller scrollbar-vertical min-h-0 flex-1 py-4">
                <CommandEmpty>No results found.</CommandEmpty>
                <CommandGroup heading="Quick actions" className="mb-4">
                    <CommandItem value="new chat" onSelect={handleNewChatSelect} className="mt-2 py-1!">
                        <CirclePlusIcon />
                        <span className="flex-1">New chat</span>
                        <Kbd className="command-enter-hint border-none bg-transparent">↵</Kbd>
                    </CommandItem>
                </CommandGroup>
                {renderConversations()}
            </CommandList>
            <CommandFooter className="shrink-0 gap-4">
                <span className="flex items-center gap-1.5">
                    <span className="flex items-center gap-1">
                        <Kbd>↑</Kbd>
                        <Kbd>↓</Kbd>
                    </span>
                    Select
                </span>
                <span className="flex items-center gap-1.5">
                    <Kbd>↵</Kbd>
                    Open
                </span>
                <span className="flex items-center gap-1.5">
                    <Kbd>esc</Kbd>
                    Close
                </span>
            </CommandFooter>
        </CommandDialog>
    );
};

export default CommandPalette;
