import ProjectShareModal from '@/app/screens/private/screens/agent/components/chat-agent/components/project-detail/components/project-share-modal';
import SpaceEditDialog from '@/app/screens/private/screens/agent/components/chat-agent/components/project-detail/components/space-edit-dialog';
import { usePinnedProjects } from '@/components/agent-chat/hooks/use-projects';
import DeleteConfirmationModal from '@/components/agent-chat/view/delete-confirmation-modal';
import ConfirmationModal from '@/components/ui/confirmation-modal';
import type { ChatAgentType } from '@/types/admin';
import type { HistoryType } from '@/types/chat';
import type { ProjectType } from '@/types/project';
import type { UserState } from '@/types/store';

type SpaceActions = ReturnType<typeof usePinnedProjects>['pinnedActions'];

interface Props {
    agent: ChatAgentType;
    user: UserState;
    activePath: string;
    spaceActions: SpaceActions;
    isConfirmationModalOpen: HistoryType | null;
    onCloseConfirmModal: () => void;
    onConfirmDeleteHistory: () => void;
    isDeleteSubmitting: boolean;
    editProject: ProjectType | null;
    onCloseEditSpace: () => void;
    deleteProject: ProjectType | null;
    onCloseDeleteSpace: () => void;
    onConfirmDeleteSpace: () => void;
    isSpaceDeleting: boolean;
    shareProject: ProjectType | null;
    onCloseShareSpace: () => void;
    onNavigateToSpaces: () => void;
}

const SidebarDialogs = (props: Props) => {
    const {
        agent,
        user,
        activePath,
        spaceActions,
        isConfirmationModalOpen,
        onCloseConfirmModal,
        onConfirmDeleteHistory,
        isDeleteSubmitting,
        editProject,
        onCloseEditSpace,
        deleteProject,
        onCloseDeleteSpace,
        onConfirmDeleteSpace,
        isSpaceDeleting,
        shareProject,
        onCloseShareSpace,
        onNavigateToSpaces,
    } = props;

    return (
        <>
            <DeleteConfirmationModal
                isOpen={Boolean(isConfirmationModalOpen)}
                onClose={onCloseConfirmModal}
                onConfirm={onConfirmDeleteHistory}
                isLoading={isDeleteSubmitting}
            />

            <SpaceEditDialog
                open={Boolean(editProject)}
                initial={
                    editProject
                        ? {
                              name: editProject.name,
                              description: editProject.description || '',
                              instructions: editProject.instructions || '',
                              folderPath: editProject.folderPath || '',
                          }
                        : null
                }
                onOpenChange={(open) => {
                    if (!open) onCloseEditSpace();
                }}
                onSave={(patch) => spaceActions.updateProject(editProject!._id, patch)}
            />

            <ConfirmationModal
                isOpen={Boolean(deleteProject)}
                onClose={onCloseDeleteSpace}
                onConfirm={onConfirmDeleteSpace}
                title="Delete space?"
                message={
                    deleteProject ? `"${deleteProject.name}" and its chats will be removed. This cannot be undone.` : ''
                }
                confirmButtonText="Delete"
                cancelButtonText="Cancel"
                isButtonLoading={isSpaceDeleting}
            />

            {shareProject ? (
                <ProjectShareModal
                    isOpen={Boolean(shareProject)}
                    projectName={shareProject.name}
                    members={shareProject.members}
                    owner={
                        shareProject.creator
                            ? {
                                  _id: shareProject.creator._id,
                                  name: shareProject.creator.name,
                                  email: shareProject.creator.email,
                                  avatar: shareProject.creator.avatar,
                              }
                            : {
                                  _id: user._id ?? '',
                                  name:
                                      [user.name?.first, user.name?.last].filter(Boolean).join(' ') ||
                                      user.email ||
                                      'You',
                                  email: user.email ?? '',
                                  avatar: user.avatar ?? undefined,
                              }
                    }
                    currentUserId={user._id ?? ''}
                    shareUrl={`${window.location.origin}/agent/${agent.slug}/spaces/${shareProject._id}`}
                    onClose={onCloseShareSpace}
                    onAddMember={(userId, role) => spaceActions.addMember(shareProject._id, userId, role)}
                    onChangeRole={(userId, role) => spaceActions.changeMemberRole(shareProject._id, userId, role)}
                    onRemoveMember={(userId) => spaceActions.removeMember(shareProject._id, userId)}
                    onLeaveSpace={() => {
                        onCloseShareSpace();
                        if (activePath?.includes(`spaces/${shareProject._id}`)) {
                            onNavigateToSpaces();
                        }
                    }}
                />
            ) : null}
        </>
    );
};

export type { Props as SidebarDialogsProps };
export default SidebarDialogs;
