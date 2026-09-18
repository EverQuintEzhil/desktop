import type { GalleryAgentType } from '@/types/admin';

import { GalleryAgent } from '../../../../../../../../../../../app/screens/private/screens/agent/components';

interface Props {
    agent: GalleryAgentType;
}

const AgentGalleryPlayground = ({ agent }: Props) => {
    return <GalleryAgent agent={agent as GalleryAgentType} key={agent.uiConfig.type} isFromAdmin />;
};

export default AgentGalleryPlayground;
