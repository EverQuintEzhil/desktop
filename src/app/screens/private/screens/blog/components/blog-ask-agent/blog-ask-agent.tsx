import { SparklesIcon } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { useAppSelector } from '@/hooks';
import { selectTenant } from '@/store/selectors';

import { buildArticlePrompt } from '../../utils/build-article-prompt';

export interface BlogAskAgentProps {
    title?: string;
    slug?: string;
}

const BlogAskAgent = ({ title, slug }: BlogAskAgentProps) => {
    const navigate = useNavigate();
    // `AuthWrapper` blocks this screen from mounting until the tenant fetch resolves, so `null`
    // here always means the key is genuinely unset — never "not loaded yet".
    const { helpCenterAgent } = useAppSelector(selectTenant);

    if (!helpCenterAgent || !title || !slug) {
        return null;
    }

    const handleClick = () => {
        // The stored slug can go stale if the agent is renamed after this key is set; the id
        // stays stable, so it — not the slug — is the safe route target.
        navigate(`/agent/${helpCenterAgent.agentId}`, {
            state: { prompt: buildArticlePrompt(title, slug), showHome: true },
        });
    };

    return (
        <Button variant="outline" className="blog-ask-agent gap-2" onClick={handleClick}>
            <SparklesIcon />
            <span className="max-w-40 truncate">Ask in {helpCenterAgent.agentName}</span>
        </Button>
    );
};

export default BlogAskAgent;
