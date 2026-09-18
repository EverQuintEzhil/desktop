import { modelDisplayName } from '@/types/admin';
import type { RoutineType } from '@/types/routines';

import type { RoutineFormApi } from '../hooks/use-routine-form';

import DeepResearchField from './deep-research-field';
import ModelPickerField from './model-picker-field';
import ModelPickerNotice from './model-picker-notice';
import SpaceField from './space-field';

interface Props {
    form: RoutineFormApi;
    selectedAgentId: string;
    areSpacesEnabled: boolean;
    routine?: RoutineType | null;
    project?: { _id: string; name: string };
}

export const RoutineModelNotice = ({ form, selectedAgentId }: Pick<Props, 'form' | 'selectedAgentId'>) => {
    if (!selectedAgentId) return null;

    return (
        <form.Field name="modelId">
            {(field) => <ModelPickerNotice agentId={selectedAgentId} value={field.state.value} />}
        </form.Field>
    );
};

const renderSpaceField = ({ form, selectedAgentId, areSpacesEnabled, routine, project }: Props) => {
    if (!areSpacesEnabled) return null;

    return (
        <form.Field name="projectId">
            {(field) => (
                <SpaceField
                    agentId={selectedAgentId}
                    value={field.state.value}
                    fallbackName={routine?.project?.name ?? project?.name}
                    onChange={(projectId) => field.handleChange(projectId)}
                />
            )}
        </form.Field>
    );
};

const renderDeepResearchField = ({ form }: Props) => (
    <form.Field name="deepResearch">
        {(field) => <DeepResearchField value={field.state.value} onChange={(next) => field.handleChange(next)} />}
    </form.Field>
);

const renderModelField = ({ form, selectedAgentId, routine }: Props) => (
    <form.Field name="modelId">
        {(field) => (
            <ModelPickerField
                agentId={selectedAgentId}
                value={field.state.value}
                storedModelLabel={routine?.model ? modelDisplayName(routine.model) : undefined}
                onChange={(modelId) => field.handleChange(modelId)}
            />
        )}
    </form.Field>
);

const RoutinePromptToolbar = (props: Props) => {
    // The depth toggle is always offered, so the bar no longer depends on there being a space or a model to pick.
    if (!props.selectedAgentId) return null;

    return (
        <div className="routine-prompt-toolbar flex items-center justify-between gap-2 rounded-b-xl border-t border-border-secondary bg-muted/30 px-2 py-1.5">
            <div className="routine-prompt-toolbar-start flex min-w-0 items-center gap-1">
                {renderSpaceField(props)}
                {renderDeepResearchField(props)}
            </div>
            <div className="routine-prompt-toolbar-end flex min-w-0 items-center gap-1">{renderModelField(props)}</div>
        </div>
    );
};

export default RoutinePromptToolbar;
