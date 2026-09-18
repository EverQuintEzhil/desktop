import { useState } from 'react';

import { useAppSelector } from '@/app/hooks';
import LibraryContent from '@/app/screens/private/screens/agent/components/chat-agent/components/library/library-content';
import type { LibraryScope } from '@/components/agent-chat/hooks/use-media-library';
import { cn } from '@/lib/utils';
import { selectUser } from '@/store/selectors';

const EmbeddedLibrary = () => {
    const user = useAppSelector(selectUser);
    const userId = user._id || '';
    const [scope, setScope] = useState<LibraryScope>('yours');

    return (
        <LibraryContent
            agentId={undefined}
            userId={userId}
            title="Library"
            scope={scope}
            onScopeChange={setScope}
            scrollMode="container"
            enableSelection
            originTypes={['chat', 'gallery', 'project']}
            containerClassName={cn(
                'flex h-full min-h-0 w-full flex-col overflow-hidden bg-background',
                '[&_.library-header]:border-b [&_.library-header]:border-border/70 [&_.library-header]:bg-background/95 [&_.library-header]:backdrop-blur',
                '[&_.library-header>div]:max-w-none [&_.library-header>div]:px-5 lg:[&_.library-header>div]:px-8',
                '[&_.library-header-title]:pr-4 lg:[&_.library-header-title]:pr-4',
                '[&_.library-content>div]:max-w-none [&_.library-content>div]:px-5 lg:[&_.library-content>div]:px-8',
                '[&_.library-file-card]:shadow-xs',
            )}
        />
    );
};

export default EmbeddedLibrary;
