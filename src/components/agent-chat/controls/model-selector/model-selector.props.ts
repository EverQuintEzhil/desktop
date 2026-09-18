import type { DropDownValueObject } from '@/components/ui/dropdown-menu';
import type { ModelValueType } from '@/types/admin';

export interface Props {
    selectedModel: DropDownValueObject<ModelValueType> | null;
    availableModels: DropDownValueObject<ModelValueType>[];
    onSelect: (model: DropDownValueObject<ModelValueType> | null) => void;
    height?: number;
}
