import type { ProjectActivityType } from '@/types/project';

export const describeActivity = (activity: ProjectActivityType): string => {
    switch (activity.type) {
        case 'project_created':
            return 'created this space';
        case 'project_updated':
            return 'updated the space';
        case 'file_added':
            return 'added knowledge';
        case 'file_removed':
            return 'removed knowledge';
        case 'conversation_shared':
            return 'shared a chat';
        case 'conversation_unshared':
            return 'unshared a chat';
        case 'member_added':
            return 'added a member';
        case 'member_role_changed':
            return "changed a member's access";
        case 'member_removed':
            return 'removed a member';
        default:
            return 'updated the space';
    }
};
