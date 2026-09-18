import { CpuIcon } from 'lucide-react';

import type { ModelType } from '@/types/admin';

import ModelsListEditor from '../components/editors/models-list-editor';
import AccordionSection from '../components/primitives/accordion-section';
import { normalizeDefaultModelFromAvailableModels, type UiConfig } from '../schema';
import type { GetUiConfigFieldError } from '../validation';

type ModelsContainer = Extract<UiConfig, { componentType: 'chat' | 'gallery' }>;

interface Props {
    componentType: ModelsContainer['componentType'];
    agentModels: ModelType[];
    models: ModelsContainer['models'];
    defaultModel: ModelsContainer['defaultModel'];
    onChange: (next: Pick<ModelsContainer, 'models' | 'defaultModel'>) => void;
    disabled?: boolean;
    getError: GetUiConfigFieldError;
    errorCount?: number;
}

const ModelsSection = ({
    componentType,
    agentModels,
    models,
    defaultModel,
    onChange,
    disabled,
    getError,
    errorCount,
}: Props) => {
    const handleChangeModels = (next: ModelsContainer['models']) => {
        onChange({
            models: next,
            defaultModel: normalizeDefaultModelFromAvailableModels(next, defaultModel),
        });
    };

    const handleDefaultModelChange = (next: ModelsContainer['defaultModel']) => {
        onChange({
            models,
            defaultModel: normalizeDefaultModelFromAvailableModels(models, next),
        });
    };

    return (
        <AccordionSection
            id="models"
            title="Models"
            icon={<CpuIcon className="size-3.5" />}
            description="Which AI models this agent can use."
            errorCount={errorCount}
        >
            <div className="-mx-4 -mb-4 overflow-hidden border-t border-border">
                <ModelsListEditor
                    componentType={componentType}
                    agentModels={agentModels}
                    disabled={disabled}
                    value={models}
                    defaultModel={defaultModel}
                    getError={getError}
                    onChange={handleChangeModels}
                    onDefaultModelChange={handleDefaultModelChange}
                />
            </div>
        </AccordionSection>
    );
};

export default ModelsSection;
