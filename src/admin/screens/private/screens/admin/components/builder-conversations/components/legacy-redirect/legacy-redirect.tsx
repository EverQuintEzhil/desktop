import { Navigate, useParams } from 'react-router-dom';

import { BUILDER_CONVERSATIONS_PATH } from '../../constants';

interface Props {
    agentSlug: string;
}

/**
 * `/admin/agents/:slug/builder-conversations/:conversationId` shipped on the v2.2 line before
 * the screen was promoted to a top-level page, so those links can be bookmarked. The splat
 * carries the conversation id across, landing the user on the same conversation.
 */
const LegacyRedirect = (props: Props) => {
    const { agentSlug } = props;
    const params = useParams();

    const target = [BUILDER_CONVERSATIONS_PATH, agentSlug, params['*']].filter(Boolean).join('/');

    return <Navigate to={target} replace />;
};

export default LegacyRedirect;
