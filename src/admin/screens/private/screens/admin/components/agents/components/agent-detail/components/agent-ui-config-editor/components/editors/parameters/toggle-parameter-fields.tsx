import { Checkbox } from '@/components/ui/checkbox';

import type { ParameterSchemaType } from '../../../schema';
import FormRow from '../../primitives/form-row';

interface ToggleParameterFieldsProps {
    paramKey: string;
    param: Extract<ParameterSchemaType, { type: 'toggle' }>;
    disabled?: boolean;
    onUpdate: (key: string, patch: (prev: ParameterSchemaType) => ParameterSchemaType) => void;
}

const ToggleParameterFields = ({ paramKey, param, disabled, onUpdate }: ToggleParameterFieldsProps) => (
    <>
        <FormRow label="Default value" sub="Initial state when the parameter is first shown">
            <Checkbox
                disabled={disabled}
                checked={param.default}
                label={param.default ? 'On' : 'Off'}
                onChange={(_, checked) =>
                    onUpdate(paramKey, (prev) => ({ ...prev, default: checked }) as ParameterSchemaType)
                }
            />
        </FormRow>
        <FormRow label="Inverse value" sub="Send false when this toggle is selected">
            <Checkbox
                id={`parameter-${paramKey.replace(/[^a-zA-Z0-9_-]/g, '-')}-toggle-inverse`}
                disabled={disabled}
                checked={param.inverse ?? false}
                label="Inverse"
                onChange={(_, checked) =>
                    onUpdate(
                        paramKey,
                        (prev) =>
                            ({
                                ...prev,
                                inverse: checked || undefined,
                            }) as ParameterSchemaType,
                    )
                }
            />
        </FormRow>
    </>
);

export default ToggleParameterFields;
