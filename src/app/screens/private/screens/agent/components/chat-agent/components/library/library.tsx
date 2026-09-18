import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';

import { useAppSelector } from '@/app/hooks';
import AgentDetails from '@/app/screens/private/screens/agents/components/agent-details';
import { type LibraryItem, type LibraryScope, normalizeScope } from '@/components/agent-chat/hooks/use-media-library';
import type { HomeSubmitPayload } from '@/components/agent-chat/types';
import { selectUser } from '@/store/selectors';
import type { ChatAgentType } from '@/types/admin';

import LibraryContent from './library-content';

interface Props {
    agent: ChatAgentType;
    onSubmit?: (mode: 'chat', payload: HomeSubmitPayload) => void;
}

const Library = (props: Props) => {
    const { agent } = props;
    const user = useAppSelector(selectUser);
    const userId = user._id || '';
    const navigate = useNavigate();

    const [searchParams] = useSearchParams();
    const scope = normalizeScope(searchParams.get('tab') ?? undefined);

    const [sidesheetOpen, setSidesheetOpen] = useState(false);

    const onScopeChange = (value: LibraryScope) => {
        if (agent.slug)
            navigate(value === 'yours' ? `/agent/${agent.slug}/library` : `/agent/${agent.slug}/library?tab=${value}`);
    };

    const onOpenChat = (item: LibraryItem) => {
        if (agent.slug && item.conversationId) {
            navigate(`/agent/${agent.slug}/chat/${item.conversationId}`);
        }
    };

    const onStartChat = (selected: LibraryItem[]) => {
        if (!selected.length || !agent.slug) return;

        const files = selected.map((item) => ({
            _id: item._id,
            tempId: `lib-${item._id}`,
            name: item.name,
            type: item.type,
            extension: item.extension,
            url: item.url,
            thumb: item.thumbnailUrl,
            size: item.size,
            isUploading: false,
        }));

        navigate(`/agent/${agent.slug}`, { state: { showHome: true, files } });
    };

    return (
        <>
            <LibraryContent
                agentId={agent._id}
                userId={userId}
                title="Library"
                agent={agent}
                scope={scope}
                onScopeChange={onScopeChange}
                onOpenChat={onOpenChat}
                onTitleInfoClick={() => setSidesheetOpen(true)}
                enableSelection
                showArtifacts
                originTypes={['chat', 'gallery', 'project']}
                onStartChat={onStartChat}
            />

            {sidesheetOpen ? (
                <AgentDetails
                    isOpen={sidesheetOpen}
                    selectedAgent={agent}
                    isAgentType
                    onClose={() => setSidesheetOpen(false)}
                />
            ) : null}
        </>
    );
};

export default Library;
