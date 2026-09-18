import { useAppSelector, usePermissions } from '@/hooks';
import { selectUser } from '@/store/selectors';
import type { AgentType } from '@/types/admin';

type EditableAgent = Pick<AgentType, 'admins' | 'creator'>;

const useCanEditAgent = (agent: EditableAgent): boolean => {
    const user = useAppSelector(selectUser);
    const { canAccessible } = usePermissions();

    const adminIds = (agent.admins ?? [])
        .map((admin) => (typeof admin === 'string' ? admin : admin?._id))
        .filter((id): id is string => Boolean(id));
    const isCreator = Boolean(user._id) && agent.creator?._id === user._id;

    // GET /agents/:id?launcher=true omits `admins`, so creator-match is the only per-agent signal the chat page has.
    return isCreator || canAccessible('agents', 'put', { adminIds });
};

export default useCanEditAgent;
