import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';

import type { ParameterSchemaType } from '../../../schema';

import { getParameterControlId, getParameterTypeLabel, renderSummaryMeta } from './parameter-helpers';

interface SourceOnlyParameterRowProps {
    paramKey: string;
    param: ParameterSchemaType;
    disabled?: boolean;
    onAdd: (key: string, param: ParameterSchemaType) => void;
}

const SourceOnlyParameterRow = ({ paramKey, param, disabled, onAdd }: SourceOnlyParameterRowProps) => (
    <div className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0">
        <div className="min-w-0">
            <div className="flex min-w-0 flex-wrap items-center gap-1.5">
                <span className="min-w-0 truncate text-sm font-medium text-text-secondary">
                    {param.label || paramKey}
                </span>
                <Badge variant="outline" className="shrink-0 text-xs">
                    {getParameterTypeLabel(param)}
                </Badge>
                <Badge variant="outline" className="shrink-0 bg-(--bg-subtle) text-xs text-text-secondary">
                    Source
                </Badge>
            </div>
            {renderSummaryMeta({ key: paramKey, param })}
        </div>
        <SimpleTooltip content="Add this model parameter to the agent UI." side="top">
            <span className="inline-flex">
                <Checkbox
                    id={getParameterControlId(paramKey, 'source-include')}
                    disabled={disabled}
                    checked={false}
                    label="Include"
                    onChange={(_, checked) => {
                        if (checked) onAdd(paramKey, param);
                    }}
                />
            </span>
        </SimpleTooltip>
    </div>
);

export default SourceOnlyParameterRow;
