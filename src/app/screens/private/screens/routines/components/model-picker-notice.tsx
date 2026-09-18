import { TriangleAlertIcon } from 'lucide-react';

import { useModelFieldState } from '../hooks/use-model-field-state';

export interface Props {
    agentId: string;
    value: string;
}

/**
 * Sits below the prompt box rather than in its toolbar: a warning has nowhere to live on a bar of triggers.
 */
const ModelPickerNotice = ({ agentId, value }: Props) => {
    const { agent, isPending, isError, options, defaultModel, isStale } = useModelFieldState(agentId, value);

    if (isPending) return null;

    if (isError || !agent) {
        return (
            <p className="model-picker-notice text-xs text-muted-foreground">
                The agent&apos;s models could not be loaded, so the model cannot be changed here. Runs use whichever
                model the agent is set to.
            </p>
        );
    }

    if (isStale) {
        return (
            <span className="model-picker-notice text-xs text-destructive">
                This model is no longer one of {agent.name}&apos;s, so runs may fail. It stays as it is until you pick
                another one.
            </span>
        );
    }

    if (defaultModel || options.length > 0) return null;

    return (
        <div className="model-picker-notice flex items-start gap-2 rounded-lg border border-destructive/40 bg-destructive/5 px-3 py-2 text-xs text-muted-foreground">
            <TriangleAlertIcon aria-hidden="true" className="mt-0.5 size-3.5 shrink-0 text-destructive" />
            <span>
                {agent.name} has no models to choose from, so every run of this routine will fail. Ask an admin to add a
                model in the agent&apos;s settings.
            </span>
        </div>
    );
};

export default ModelPickerNotice;
