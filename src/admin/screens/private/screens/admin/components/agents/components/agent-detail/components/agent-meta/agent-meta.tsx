import capitalize from 'lodash/capitalize';

import type { AgentType } from '@/types/admin';

interface Props {
    agent: AgentType;
}

const AgentMeta = ({ agent }: Props) => {
    return (
        <div className="metabar flex flex-wrap items-center gap-x-3 gap-y-1">
            <span className="text-sm text-text-secondary">{agent.name}</span>
            <span className="meta-details-dot inline-block h-1 w-1 rounded-full bg-gray-300" />
            <span className="text-sm text-text-secondary">{capitalize(agent.type)}</span>
            <span className="meta-details-dot inline-block h-1 w-1 rounded-full bg-gray-300" />
            <span className="text-sm text-text-secondary">{agent.identifier}</span>
            <span className="meta-details-dot inline-block h-1 w-1 rounded-full bg-gray-300" />
            <span className="text-sm text-text-secondary">{agent.slug}</span>
            {agent?.creator?.name && (
                <>
                    <span className="meta-details-dot inline-block h-1 w-1 rounded-full bg-gray-300" />
                    <span className="text-sm text-text-secondary">
                        {`Created by ${agent.creator.name.first} ${agent.creator.name.last}`}
                    </span>
                </>
            )}
        </div>
    );
};

export default AgentMeta;
