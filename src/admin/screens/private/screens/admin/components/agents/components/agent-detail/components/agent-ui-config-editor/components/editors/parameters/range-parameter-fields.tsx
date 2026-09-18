import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';

import type { ParameterSchemaType } from '../../../schema';
import FieldHelp from '../../primitives/field-help';
import FormRow from '../../primitives/form-row';

type RangeParam = Extract<ParameterSchemaType, { type: 'range' }>;

interface Props {
    paramKey: string;
    param: RangeParam;
    disabled?: boolean;
    onUpdate: (key: string, patch: (prev: ParameterSchemaType) => ParameterSchemaType) => void;
}

const RangeParameterFields = ({ paramKey, param, disabled, onUpdate }: Props) => (
    <>
        <FormRow label="Range values" sub="Min, max, step, and fallback default">
            <div className="grid grid-cols-1 gap-3 @[360px]:grid-cols-2 @[600px]:grid-cols-4">
                <div className="flex min-w-0 flex-col gap-1">
                    <FieldHelp label="Min" />
                    <Input
                        type="number"
                        readOnly={disabled}
                        value={String(param.range.min)}
                        onChange={(e) =>
                            onUpdate(paramKey, (prev) => ({
                                ...(prev as RangeParam),
                                range: { ...param.range, min: Number(e.target.value) },
                            }))
                        }
                    />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                    <FieldHelp label="Max" />
                    <Input
                        type="number"
                        readOnly={disabled}
                        value={String(param.range.max)}
                        onChange={(e) =>
                            onUpdate(paramKey, (prev) => ({
                                ...(prev as RangeParam),
                                range: { ...param.range, max: Number(e.target.value) },
                            }))
                        }
                    />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                    <FieldHelp label="Step" />
                    <Input
                        type="number"
                        readOnly={disabled}
                        value={String(param.range.step)}
                        onChange={(e) =>
                            onUpdate(paramKey, (prev) => ({
                                ...(prev as RangeParam),
                                range: { ...param.range, step: Number(e.target.value) },
                            }))
                        }
                    />
                </div>
                <div className="flex min-w-0 flex-col gap-1">
                    <FieldHelp label="Default" />
                    <Input
                        type="number"
                        readOnly={disabled}
                        value={String(param.default)}
                        onChange={(e) =>
                            onUpdate(paramKey, (prev) => ({
                                ...(prev as RangeParam),
                                default: Number(e.target.value),
                            }))
                        }
                    />
                </div>
            </div>
        </FormRow>
        <FormRow label="Apply by default" sub="Show this parameter by default before the user adds it">
            <div className="flex h-8 items-center">
                <Checkbox
                    id={`parameter-${paramKey.replace(/[^a-zA-Z0-9_-]/g, '-')}-range-preselect-default`}
                    disabled={disabled}
                    checked={param.showDefault ?? false}
                    label="Apply by default"
                    onChange={(_, checked) =>
                        onUpdate(paramKey, (prev) => ({
                            ...prev,
                            showDefault: checked || undefined,
                        }))
                    }
                />
            </div>
        </FormRow>
    </>
);

export default RangeParameterFields;
