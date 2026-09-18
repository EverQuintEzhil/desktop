import type { ParameterSchemaType } from '../../../schema';

export type EditableParameterType = 'select' | 'range' | 'toggle';

export interface EditableParameterTypeConfig {
    value: EditableParameterType;
    label: string;
    create: () => ParameterSchemaType;
}

export const emptySelectParameter = (): ParameterSchemaType => ({
    type: 'select',
    label: '',
    default: { label: '', value: '' },
    options: [],
});

export const emptyRangeParameter = (): ParameterSchemaType => ({
    type: 'range',
    label: '',
    default: 0,
    range: { min: 0, max: 100, step: 1 },
});

export const emptyToggleParameter = (): ParameterSchemaType => ({
    type: 'toggle',
    label: '',
    default: false,
});

export const EDITABLE_PARAMETER_TYPES: EditableParameterTypeConfig[] = [
    { value: 'select', label: 'Select', create: emptySelectParameter },
    { value: 'range', label: 'Range', create: emptyRangeParameter },
    { value: 'toggle', label: 'Toggle', create: emptyToggleParameter },
];

export const DEFAULT_PARAMETER_TYPE: EditableParameterType = 'select';

export const getParameterTypeLabel = (param: ParameterSchemaType): string => {
    if ('component' in param && param.component === 'textbox') return 'Textbox';
    if ('type' in param && param.type === 'toggle') return 'Toggle';

    let editableType: EditableParameterType | undefined;

    if ('options' in param) editableType = 'select';
    else if ('range' in param) editableType = 'range';

    const config = EDITABLE_PARAMETER_TYPES.find((c) => c.value === editableType);

    return editableType ? (config?.label ?? editableType) : 'Parameter';
};
