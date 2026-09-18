import type { DropDownValueObject } from '@/components/ui/dropdown-menu';
import Select from '@/components/ui/select';
import type { ModelValueType } from '@/types/admin';

import './model-selector.scss';

interface Props {
    selectedModel: DropDownValueObject<ModelValueType> | null;
    availableModels: DropDownValueObject<ModelValueType>[];
    onSelect: (model: DropDownValueObject<ModelValueType> | null) => void;
    popupStyles?: string;
    isDarkMode?: boolean;
}

const ModelSelector = (props: Props) => {
    const { selectedModel, availableModels, onSelect, isDarkMode = false } = props;

    if (availableModels.length <= 1) {
        return null;
    }

    return (
        <Select
            value={selectedModel?.value.name ?? null}
            variant={isDarkMode ? 'black' : 'outline'}
            className="model-selector text-xs"
            options={availableModels.map((model) => ({
                label: model.label ?? model.value?.name ?? 'Unknown Model',
                value: model.value.name,
            }))}
            onChange={(newValueName) => {
                const selected = availableModels.find((m) => m.value.name === newValueName);

                onSelect(selected || null);
            }}
            allowSearch={false}
            allowDeselect={false}
            placeholder="No model selected"
            triggerLabelClassName={`text-xs font-medium ${isDarkMode ? 'text-white' : 'text-primary'}!`}
            triggerChevronIconClassName={`h-4 w-5 flex items-center justify-center text-xs! ${isDarkMode ? 'text-white!' : 'text-primary!'}`}
            popoverClassName={`model-selector-popover rounded-xl min-w-max max-w-[280px] ${isDarkMode ? 'dark-mode' : ''}`}
        />
    );
};

export default ModelSelector;
