import type { ParameterSchemaType } from '../../../schema';

import { type EditableParameterType, getParameterTypeLabel } from './types';

export const getParameterControlId = (key: string, suffix: string): string =>
    `parameter-${key.replace(/[^a-zA-Z0-9_-]/g, '-')}-${suffix}`;

export const getEditableParameterType = (param: ParameterSchemaType): EditableParameterType | undefined => {
    if ('options' in param) return 'select';
    if ('range' in param) return 'range';
    if ('type' in param && param.type === 'toggle') return 'toggle';

    return undefined;
};

interface SummaryMetaProps {
    key: string;
    param: ParameterSchemaType;
}

export const renderSummaryMeta = ({ key, param }: SummaryMetaProps) => {
    const renderDetails = () => {
        if ('component' in param && param.component === 'textbox') return <span>textbox input</span>;

        if ('type' in param && param.type === 'toggle') {
            const toggleParam = param as Extract<ParameterSchemaType, { type: 'toggle' }>;

            return (
                <>
                    <span>{`Default: ${toggleParam.default ? 'On' : 'Off'}`}</span>
                    <span>·</span>
                    <span>{`Selected sends: ${toggleParam.inverse ? 'false' : 'true'}`}</span>
                </>
            );
        }

        if ('range' in param) {
            return (
                <>
                    <span>{`${param.range.min}-${param.range.max}, step ${param.range.step}`}</span>
                    <span>·</span>
                    <span>{`Default: ${param.default}`}</span>
                </>
            );
        }

        if ('options' in param) {
            return (
                <>
                    <span>
                        {param.options.length} {param.options.length === 1 ? 'option' : 'options'}
                    </span>
                    <span>·</span>
                    <span>{param.default.value ? `Default: ${param.default.value}` : 'Default: none'}</span>
                </>
            );
        }

        return null;
    };

    return (
        <div className="flex min-w-0 flex-wrap items-center gap-1 text-xs text-text-secondary">
            <span className="max-w-[180px] truncate rounded bg-(--bg-subtle) px-1.5 py-0.5 font-mono text-[11px]">
                {key}
            </span>
            <span>·</span>
            {renderDetails()}
            {('component' in param && param.component === 'textbox') ||
            ('type' in param && param.type === 'toggle') ? null : (
                <>
                    <span>·</span>
                    <span>
                        {(param as Extract<ParameterSchemaType, { showDefault?: boolean }>).showDefault
                            ? 'preselects default'
                            : 'manual selection'}
                    </span>
                </>
            )}
        </div>
    );
};

export { getParameterTypeLabel };
export type { EditableParameterType };
