import {
    ChevronRightIcon,
    CircleAlertIcon,
    CircleCheckIcon,
    CircleXIcon,
    Clock3Icon,
    LoaderCircleIcon,
    type LucideIcon,
} from 'lucide-react';
import { useState } from 'react';
import { JsonView, collapseAllNested } from 'react-json-view-lite';
import 'react-json-view-lite/dist/index.css';

import { CopyButton } from '@/components';
import Tag from '@/components/ui/tag';

import './conversation-details.scss';

export interface FlowData {
    _id: string;
    flow_id: string;
    request_id: string;
    agent_id: string;
    agent_type: string;
    conversation_id: string;
    flow_name: string;
    flow_type: string;
    flow_index: number;
    flow_status: 'completed' | 'failed' | 'running' | 'pending';
    flow_input: string;
    flow_output: string;
    flow_error: string | null;
    flow_duration_ms: number;
    started_at: string;
    completed_at: string;
    timestamp: number;
    parent_flow_id: string | null;
    context_state: string;
    payload: string;
    metadata: unknown;
    tags: string[];
    environment: string;
    version: string;
    debug_info: unknown;
    is_sub_flow: boolean;
    is_tool_execution: boolean;
    tool_call_id: string | null;
    tool_name: string | null;
    is_deleted: boolean;
    user: unknown;
}

interface Props {
    data: FlowData[];
}

const ConversationDetails = (props: Props) => {
    const { data } = props;
    const [expandedFlows, setExpandedFlows] = useState<Set<string>>(new Set());

    const formatDuration = (ms: number) => {
        if (ms < 1000) return `${ms}ms`;

        return `${(ms / 1000).toFixed(2)}s`;
    };

    const getStatusIcon = (status: string): LucideIcon => {
        switch (status) {
            case 'completed':
                return CircleCheckIcon;
            case 'failed':
                return CircleXIcon;
            case 'running':
                return LoaderCircleIcon;
            case 'pending':
                return Clock3Icon;
            default:
                return CircleAlertIcon;
        }
    };

    const parseJsonSafely = (jsonString: string): unknown => {
        try {
            return JSON.parse(jsonString);
        } catch {
            return jsonString;
        }
    };

    const toggleFlow = (flowId: string) => {
        const newExpanded = new Set(expandedFlows);

        if (newExpanded.has(flowId)) {
            newExpanded.delete(flowId);
        } else {
            newExpanded.add(flowId);
        }
        setExpandedFlows(newExpanded);
    };

    const formatKey = (key: string) => {
        return key.replace(/_/g, ' ').replace(/\b\w/g, (l) => l.toUpperCase());
    };

    const isJsonString = (str: unknown): str is string => {
        if (typeof str !== 'string') return false;
        try {
            JSON.parse(str);

            return true;
        } catch {
            return false;
        }
    };

    const getDisplayValue = (val: unknown): string => {
        if (isJsonString(val)) {
            return JSON.stringify(parseJsonSafely(val), null, 2);
        }
        if (typeof val === 'object') {
            return JSON.stringify(val, null, 2);
        }

        return String(val);
    };

    const getParsedValue = (val: unknown): unknown => {
        if (isJsonString(val)) {
            return parseJsonSafely(val);
        }
        if (typeof val === 'object' && val !== null) {
            return val;
        }

        return null;
    };

    const isJsonValue = (val: unknown): boolean => {
        const parsed = getParsedValue(val);

        if (parsed === null) return false;
        if (Array.isArray(parsed)) return parsed.length > 0;
        if (typeof parsed === 'object') return Object.keys(parsed).length > 0;

        return true;
    };

    const renderContent = (value: unknown) => {
        const parsedValue = getParsedValue(value);

        if (parsedValue !== null && typeof parsedValue === 'object') {
            const hasContent = Array.isArray(parsedValue)
                ? parsedValue.length > 0
                : Object.keys(parsedValue).length > 0;

            if (hasContent) {
                return (
                    <div className="json-view-wrapper rounded-sm p-[6px]">
                        <JsonView data={parsedValue} shouldExpandNode={collapseAllNested} clickToExpandNode />
                    </div>
                );
            }
        }

        return <pre className="value-pre rounded-sm p-[6px]">{getDisplayValue(value)}</pre>;
    };

    const renderField = (key: string, value: unknown) => {
        const excludedKeys = [
            '_id',
            'flow_id',
            'request_id',
            'agent_id',
            'agent_type',
            'conversation_id',
            'flow_name',
            'flow_type',
            'flow_index',
            'flow_status',
            'flow_duration_ms',
            'started_at',
            'completed_at',
            'timestamp',
            'tags',
            'is_deleted',
        ];

        if (excludedKeys.includes(key)) {
            return null;
        }

        if (
            value === null ||
            value === undefined ||
            value === '' ||
            value === '{}' ||
            (Array.isArray(value) && value.length === 0) ||
            (typeof value === 'object' && Object.keys(value).length === 0)
        ) {
            return null;
        }

        return (
            <div key={key} className="each-row flex flex-col">
                <div className="flex items-center justify-between">
                    <span className="text-xs font-medium">{formatKey(key)}</span>
                    {isJsonValue(value) && <CopyButton text={getDisplayValue(value)} size="small" />}
                </div>

                {renderContent(value)}
            </div>
        );
    };

    const renderTagsSection = (tags: string[]) => {
        return (
            <div className="each-row flex flex-col">
                <span className="text-xs font-medium">Tags</span>
                <div className="flex flex-wrap gap-1">
                    {tags.map((tag, tagIndex) => (
                        <Tag key={tagIndex} size="small" className="flow-tag">
                            {tag}
                        </Tag>
                    ))}
                </div>
            </div>
        );
    };

    const renderFlowHeader = (flow: FlowData, isExpanded: boolean) => {
        const { _id, flow_status, flow_name, flow_type, flow_duration_ms } = flow;
        const StatusIcon = getStatusIcon(flow_status);

        return (
            <div
                className="flow-header-row flex items-center justify-between gap-2 p-2"
                onClick={() => toggleFlow(_id)}
            >
                <div className="flex items-center gap-2">
                    <ChevronRightIcon className={`flow-chevron-icon ${isExpanded ? 'is-expanded' : ''} size-4`} />
                    <StatusIcon className="flow-status-icon size-4" data-status={flow_status} />
                    <span className="text-xs font-medium">{flow_name}</span>
                    <span className="text-xs font-medium text-text-secondary">{flow_type}</span>
                </div>
                <span className="text-xs">{formatDuration(flow_duration_ms)}</span>
            </div>
        );
    };

    const renderFlowContent = (flow: FlowData) => {
        const { tags, ...rest } = flow;

        return (
            <div className="is-expanded flex flex-col gap-4 pb-4">
                {Object.entries(rest).map(([key, value]) => renderField(key, value))}
                {renderTagsSection(tags)}
            </div>
        );
    };

    const renderFlow = (flow: FlowData) => {
        const { _id } = flow;
        const isExpanded = expandedFlows.has(_id);

        return (
            <div key={_id} className="collapsed-expanded accordion flow-accordion">
                {renderFlowHeader(flow, isExpanded)}
                {isExpanded && renderFlowContent(flow)}
            </div>
        );
    };

    return <div className="conversation-details flex w-full flex-col gap-3 px-4 py-2">{data.map(renderFlow)}</div>;
};

export default ConversationDetails;
