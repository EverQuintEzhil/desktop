import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';

import { modelDisplayName } from '@/types/admin';
import type { RoutineType } from '@/types/routines';
import { formatDateTime } from '@/utils/date';

import { agentDefaultModel, useAgentDetail } from '../hooks/use-agent-detail';
import { describeScheduleWithZone } from '../utils/cron-schedule';

interface Props {
    routine: RoutineType;
}

const renderRow = (label: string, value: ReactNode) => (
    <div key={label} className="routine-detail-info-row flex flex-col gap-1.5">
        <span className="text-xs font-medium tracking-wide text-(--text-secondary) uppercase">{label}</span>
        <div className="text-sm leading-6 text-(--text-primary)">{value}</div>
    </div>
);

const renderAgentValue = (routine: RoutineType) => {
    const agent = routine.agent;

    if (!agent) return '—';
    if (!agent.slug) return <span className="break-words">{agent.name}</span>;

    return (
        <Link
            to={`/agent/${agent.slug}/routines`}
            className="rounded break-words hover:underline focus-visible:ring-2 focus-visible:ring-(--color-focus-ring) focus-visible:outline-none"
        >
            {agent.name}
        </Link>
    );
};

const renderModelValue = (ownModel: string, defaultModel: string) => {
    if (ownModel) return ownModel;
    if (!defaultModel) return 'Default';

    return (
        <>
            {defaultModel}
            <span className="text-(--text-secondary)"> · agent default</span>
        </>
    );
};

const RoutineDetailInfo = ({ routine }: Props) => {
    const schedule = describeScheduleWithZone(routine.cron, routine.runOnce, routine.runAt, routine.timezone);
    const ownModel = modelDisplayName(routine.model);
    // Only the full agent record names the model a routine without its own actually runs on.
    const { data: agent } = useAgentDetail(ownModel ? '' : routine.agentId);
    const defaultModel = agent ? modelDisplayName(agentDefaultModel(agent)) : '';

    return (
        <div className="routine-detail-info flex flex-col gap-5 rounded-2xl border border-border bg-card p-4">
            {renderRow('Agent', renderAgentValue(routine))}
            {routine.project?.name
                ? renderRow('Space', <span className="break-words">{routine.project.name}</span>)
                : null}
            {schedule ? renderRow('Repeats', schedule) : null}
            {/* Every row stays rendered: a hidden row reads as missing data rather than as an unset value. */}
            {renderRow('Model', renderModelValue(ownModel, defaultModel))}
            {renderRow('Email', routine.emailOnRun ? 'On — the report is emailed after every run' : 'Off')}
            {renderRow('Created', formatDateTime(routine.createdAt))}
        </div>
    );
};

export default RoutineDetailInfo;
