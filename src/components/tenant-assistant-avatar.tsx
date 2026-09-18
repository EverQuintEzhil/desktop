import { useChatHost } from '@/components/chat-host';
import AssistantAvatar from '@/components/chat/primitives/assistant-avatar';

interface TenantAssistantAvatarProps {
    className?: string;
}

const TenantAssistantAvatar = ({ className }: TenantAssistantAvatarProps) => {
    const { session } = useChatHost();
    const tenant = session.tenant;

    return (
        <AssistantAvatar
            logoSrc={tenant?.logoSrc}
            logoSrcDark={tenant?.logoSrcDark}
            name={tenant?.name}
            className={className}
        />
    );
};

export default TenantAssistantAvatar;
