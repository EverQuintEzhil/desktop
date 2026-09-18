import type { UnpinnedProjectsState } from '@/components/agent-chat/hooks/use-unpinned-projects';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import type { ChatAgentType } from '@/types/admin';
import type { ProjectType } from '@/types/project';

import SpaceItem from './space-item';

interface Props {
    id: string;
    agent: ChatAgentType;
    spaces: UnpinnedProjectsState;
    isOwner: (project: ProjectType) => boolean;
    canEdit: (project: ProjectType) => boolean;
    onMobileClose?: () => void;
    onTogglePin: (project: ProjectType) => void;
    onEdit: (project: ProjectType) => void;
    onDelete: (project: ProjectType) => void;
    onShare: (project: ProjectType) => void;
}

const UnpinnedSpacesList = (props: Props) => {
    const { id, agent, spaces, isOwner, canEdit, onMobileClose, onTogglePin, onEdit, onDelete, onShare } = props;
    const {
        unpinnedProjects,
        isUnpinnedProjectsLoading,
        isUnpinnedProjectsError,
        hasNextUnpinnedProjectsPage,
        isFetchingNextUnpinnedProjectsPage,
        fetchNextUnpinnedProjects,
    } = spaces;

    const renderPlaceholder = () => {
        if (isUnpinnedProjectsLoading) return null;
        if (isUnpinnedProjectsError) {
            return <li className="px-2 py-1 text-sm text-(--sidebar-foreground)/60">Could not load spaces</li>;
        }
        if (unpinnedProjects.length === 0) {
            return <li className="px-2 py-1 text-sm text-(--sidebar-foreground)/60">No unpinned spaces</li>;
        }

        return null;
    };

    const renderShowMore = () => {
        if (!hasNextUnpinnedProjectsPage) return null;

        return (
            <li className="nav-list-item">
                <Button
                    variant="ghost"
                    size="sm"
                    className="w-full justify-center text-sm text-(--sidebar-foreground) hover:bg-(--sidebar-primary) hover:text-(--sidebar-primary-foreground)"
                    disabled={isFetchingNextUnpinnedProjectsPage}
                    onClick={() => fetchNextUnpinnedProjects()}
                >
                    {isFetchingNextUnpinnedProjectsPage ? (
                        <Spinner className="text-sidebar-foreground" />
                    ) : (
                        'Show more spaces'
                    )}
                </Button>
            </li>
        );
    };

    return (
        <ul id={id} className="nav-list ml-2 flex flex-col gap-0.5 border-l border-(--sidebar-foreground)/15 pl-2">
            {renderPlaceholder()}
            {unpinnedProjects.map((project) => (
                <SpaceItem
                    key={project._id}
                    project={project}
                    agent={agent}
                    isPinned={false}
                    isOwner={isOwner(project)}
                    canEdit={canEdit(project)}
                    onMobileClose={onMobileClose}
                    onTogglePin={onTogglePin}
                    onEdit={onEdit}
                    onDelete={onDelete}
                    onShare={onShare}
                />
            ))}
            {renderShowMore()}
        </ul>
    );
};

export type { Props as UnpinnedSpacesListProps };
export default UnpinnedSpacesList;
