import { JsonView, collapseAllNested } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

import { ExpandableText } from '@/components';

import { parseJsonString } from './parse-json-string';

export const renderValue = (value: unknown) => {
    if (value === null || value === undefined) return null;

    if (typeof value === 'string') {
        const parsed = parseJsonString(value);

        if (parsed !== null && typeof parsed === 'object') {
            return (
                <div className="json-view-wrapper rounded-sm p-[6px]">
                    <JsonView data={parsed as object} shouldExpandNode={collapseAllNested} clickToExpandNode />
                </div>
            );
        }

        return (
            <ExpandableText maxLines={3}>
                <span className="text-xs">{value}</span>
            </ExpandableText>
        );
    }

    if (typeof value === 'object') {
        return (
            <div className="json-view-wrapper rounded-sm p-[6px]">
                <JsonView data={value as object} shouldExpandNode={collapseAllNested} clickToExpandNode />
            </div>
        );
    }

    return <span className="text-xs">{String(value)}</span>;
};
