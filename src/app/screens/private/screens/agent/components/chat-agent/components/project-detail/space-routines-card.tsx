import { AlertTriangleIcon, PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { RoutineFormModal } from '@/app/screens/private/screens/routines/routine-form-modal';
import { describeScheduleWithZone } from '@/app/screens/private/screens/routines/utils/cron-schedule';
import { routineIcon } from '@/app/screens/private/screens/routines/utils/routine-icon';
import ShowMoreButton from '@/components/show-more-button';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import Spinner from '@/components/ui/spinner';
import { useRoutinesQuery } from '@/lib/api/app/routines';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import type { ChatAgentType } from '@/types/admin';
import type { RoutineType } from '@/types/routines';

import { CARD_LIST_CLASS_NAME, CARD_ROW_CLASS_NAME, CARD_STATE_ROW_CLASS_NAME } from './constants';

export interface Props {
    agent: ChatAgentType;
    projectId: string;
    projectName: string;
}

const ROUTINES_PAGE_SIZE = 20;

const RoutineRowIcon = ({ routine }: { routine: { name: string; icon?: string | null } }) => {
    const Icon = routineIcon(routine.icon);

    return <Icon className="size-4" aria-hidden="true" />;
};

const SpaceRoutinesCard = ({ agent, projectId, projectName }: Props) => {
    const [isCreateOpen, setIsCreateOpen] = useState(false);
    const [size, setSize] = useState(ROUTINES_PAGE_SIZE);
    const { data, isLoading, isFetching, isError, error, refetch } = useRoutinesQuery(
        { projectId, size },
        { poll: false },
    );

    const routines = data?.values ?? [];
    const totalCount = data?.pageInfo.totalCount ?? routines.length;

    const renderRow = (routine: RoutineType) => (
        <li key={routine._id} className={CARD_ROW_CLASS_NAME}>
            <Link
                to={`/agent/${agent.slug}/routines?projectId=${encodeURIComponent(projectId)}`}
                className="flex min-w-0 flex-1 items-center gap-3 text-foreground no-underline"
            >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                    <RoutineRowIcon routine={routine} />
                </span>
                <span className="space-routines-card-row-content flex min-w-0 flex-1 flex-col">
                    <span className="truncate text-sm font-medium">{routine.name}</span>
                    <span className="truncate text-xs text-muted-foreground">
                        {describeScheduleWithZone(routine.cron, routine.runOnce, routine.runAt, routine.timezone) ||
                            '—'}
                    </span>
                </span>
            </Link>
            <Badge variant={routine.status === 'active' ? 'secondary' : 'outline'}>
                {routine.status === 'active' ? 'Active' : 'Paused'}
            </Badge>
        </li>
    );

    const renderBody = () => {
        if (isLoading) {
            return (
                <div className={CARD_STATE_ROW_CLASS_NAME}>
                    <Spinner className="size-4" />
                </div>
            );
        }

        if (isError) {
            return (
                <div className="flex flex-col items-center gap-3 px-4 py-6 text-center">
                    <AlertTriangleIcon aria-hidden="true" className="size-6 text-destructive" />
                    <p className="text-sm text-muted-foreground">
                        {getApiErrorMessage(error, "This space's routines could not be loaded.")}
                    </p>
                    <Button type="button" size="sm" variant="outline" onClick={() => void refetch()}>
                        Try again
                    </Button>
                </div>
            );
        }

        if (routines.length === 0) {
            return <div className={CARD_STATE_ROW_CLASS_NAME}>No routines report into this space yet</div>;
        }

        return (
            <ul className="space-routines-card-list scrollbar-controller scrollbar-vertical flex flex-col lg:max-h-[192px]">
                {routines.map(renderRow)}
                <li className="list-none">
                    <ShowMoreButton
                        hasMore={routines.length < totalCount}
                        isLoading={isFetching}
                        onClick={() => setSize((current) => current + ROUTINES_PAGE_SIZE)}
                    />
                </li>
            </ul>
        );
    };

    return (
        <div className="space-routines-card flex flex-col gap-2">
            <div className="space-routines-card-header flex h-6 items-center justify-between gap-2 px-1">
                <span className="flex items-center gap-2 text-sm font-medium text-foreground">
                    Scheduled
                    {isLoading || isError ? null : (
                        <Badge
                            variant="secondary"
                            className="h-5 min-w-5 justify-center rounded-full px-1.5 text-[11px] font-medium text-muted-foreground"
                        >
                            {totalCount}
                        </Badge>
                    )}
                </span>
                <Button
                    variant="ghost"
                    size="icon-xs"
                    aria-label="New routine"
                    className="rounded-full"
                    onClick={() => setIsCreateOpen(true)}
                >
                    <PlusIcon />
                </Button>
            </div>
            <div className={CARD_LIST_CLASS_NAME}>{renderBody()}</div>

            {isCreateOpen ? (
                <RoutineFormModal
                    open
                    onOpenChange={setIsCreateOpen}
                    agent={{ _id: agent._id, name: agent.name }}
                    project={{ _id: projectId, name: projectName }}
                />
            ) : null}
        </div>
    );
};

export default SpaceRoutinesCard;
