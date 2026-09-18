import type { ReactElement, ReactNode } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import ExpandableText from '@/components/expandable-text';
import JSONEditor from '@/components/json-editor';
import MultiSelect from '@/components/multi-select';
import FormField from '@/components/ui/form-field';
import { cn } from '@/lib/utils';
import { parseJsonIfValid } from '@/utils';

import { ParameterLabelWithInfo, type ToolParameterSchema } from '../../parameters-schema';
import type {
    AnyFormFieldApi,
    ExecuteFormFieldProps,
    ExecutionResultState,
    ExecuteToolFormValues,
} from '../code-manager.types';
import { executionResultPlainText, validateRequestBodyWithToolParameters } from '../code-manager.utils';

interface CodeManagerExecutePanelProps {
    ExecuteFormField: (props: ExecuteFormFieldProps) => ReactElement;
    executionResult: ExecutionResultState | null;
    isExecuting: boolean;
    canUserEdit: boolean;
    toolParameters: ToolParameterSchema | undefined;
    fetchAgents: (query: string, pageNo?: number) => Promise<{ value: string; label: string }[]>;
    fetchDataStoresForSelect: (query: string) => Promise<{ value: string; label: string }[]>;
    fetchModelsForSelect: (query: string) => Promise<{ value: string; label: string }[]>;
}

const ExecutionResult = ({
    executionResult,
    isExecuting,
}: {
    executionResult: ExecutionResultState | null;
    isExecuting: boolean;
}): ReactNode => {
    if (isExecuting) {
        return (
            <>
                <h2 className="shrink-0 text-xs font-medium text-(--text-primary)">Response</h2>
                <span className="text-xs text-text-secondary">Executing tool...</span>
            </>
        );
    }

    if (!executionResult?.executed) {
        return (
            <>
                <h2 className="shrink-0 text-xs font-medium text-(--text-primary)">Response</h2>
                <span className="text-xs text-text-secondary">Tool has not been executed yet.</span>
            </>
        );
    }

    if (executionResult.error) {
        return (
            <div className="flex min-h-0 flex-1 flex-col gap-1">
                <h2 className="shrink-0 text-xs font-medium text-(--text-primary)">Response - Lua Execution Error</h2>
                <p className="text-xs text-(--text-primary)">
                    <span className="font-medium">Error Name:</span> {executionResult.errorName}
                </p>
                <p className="text-xs text-(--text-primary)">
                    <span className="font-medium">Error Message:</span>{' '}
                    <ExpandableText textClassName="text-xs text-text-secondary" maxLines={1}>
                        {executionResult.error}
                    </ExpandableText>
                </p>
                {executionResult.luaErrorObject && (
                    <div className="flex min-h-0 flex-1 flex-col gap-2">
                        <div
                            className={cn(
                                'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-md border',
                                'border-border-secondary bg-(--bg-primary)',
                            )}
                        >
                            <JSONEditor
                                content={{ json: executionResult.luaErrorObject }}
                                readOnly
                                mode="text"
                                mainMenuBar={false}
                                statusBar={false}
                                className="h-full min-h-0 min-w-0 flex-1"
                            />
                        </div>
                    </div>
                )}
            </div>
        );
    }

    const { data } = executionResult;

    if (data !== null && typeof data === 'object') {
        return (
            <>
                <h2 className="mb-1 shrink-0 text-sm font-medium text-(--text-primary)">Response</h2>
                <div className="flex min-h-0 flex-1 flex-col gap-2">
                    <div
                        className={cn(
                            'flex min-h-0 w-full min-w-0 flex-1 flex-col overflow-hidden rounded-md border',
                            'border-(--border-secondary) bg-(--bg-primary)',
                        )}
                    >
                        <JSONEditor
                            content={{ json: data }}
                            readOnly
                            mode="text"
                            mainMenuBar={false}
                            statusBar={false}
                            className="h-full min-h-0 min-w-0 flex-1"
                        />
                    </div>
                </div>
            </>
        );
    }

    return (
        <div className="scrollbar-controller scrollbar-vertical scrollbar-horizontal flex flex-col gap-2 pr-1">
            <pre className={cn('text-sm wrap-break-word whitespace-pre-wrap', 'text-text-secondary')}>
                {executionResultPlainText(data)}
            </pre>
        </div>
    );
};

const CodeManagerExecutePanel = ({
    ExecuteFormField,
    canUserEdit,
    isExecuting,
    toolParameters,
    fetchAgents,
    fetchDataStoresForSelect,
    fetchModelsForSelect,
}: CodeManagerExecutePanelProps) => (
    <div className="scrollbar-controller scrollbar-vertical flex min-h-0 flex-1 flex-col gap-4 p-4 lg:border-l lg:border-border-secondary">
        <ExecuteFormField
            name="agentIds"
            children={(field: AnyFormFieldApi) => (
                <FormField label="Agent" field={field}>
                    {() => (
                        <MultiSelect
                            noneLabel="Clear All Agents"
                            useSearchCondition={true}
                            allowSearch={true}
                            value={field.state.value}
                            data={fetchAgents}
                            onSelect={(val) => {
                                field.handleChange(val);
                            }}
                            defaultText="Filter by Agents"
                            disabled={isExecuting}
                            maximumShow={1}
                        />
                    )}
                </FormField>
            )}
        />
        <ExecuteFormField
            name="dataStoreIds"
            children={(field: AnyFormFieldApi) => (
                <FormField label="Data Stores" field={field}>
                    {() => (
                        <MultiSelect
                            noneLabel="Clear All Data Stores"
                            useSearchCondition={true}
                            allowSearch={true}
                            value={field.state.value}
                            data={fetchDataStoresForSelect}
                            onSelect={(val) => {
                                field.handleChange(val);
                            }}
                            defaultText="Filter by Data Stores"
                            disabled={isExecuting}
                            maximumShow={1}
                        />
                    )}
                </FormField>
            )}
        />
        <ExecuteFormField
            name="modelIds"
            children={(field: AnyFormFieldApi) => (
                <FormField label="Models" field={field}>
                    {() => (
                        <MultiSelect
                            noneLabel="Clear All Models"
                            useSearchCondition={true}
                            allowSearch={true}
                            value={field.state.value}
                            data={fetchModelsForSelect}
                            onSelect={(val) => {
                                field.handleChange(val);
                            }}
                            defaultText="Filter by Models"
                            disabled={isExecuting}
                            maximumShow={1}
                        />
                    )}
                </FormField>
            )}
        />
        <ExecuteFormField
            name="parameters"
            children={(field) => (
                <FormField label="" field={field} className="min-h-0 flex-1">
                    {() => (
                        <>
                            <ParameterLabelWithInfo
                                toolParameters={toolParameters}
                                disabled={isExecuting}
                                title="Parameter restrictions"
                                description={`The parameters is validated against the tool parameter schema. Each field below lists
                constraints and a small example that satisfies the schema when possible.`}
                            >
                                <span>
                                    Parameters
                                    <span className="text-xs text-destructive">*</span>
                                </span>
                            </ParameterLabelWithInfo>
                            <div className="flex min-h-0 flex-1">
                                <JSONEditor
                                    isErrored={false}
                                    className="h-full w-full"
                                    containerClassName="w-full"
                                    content={field.state.value}
                                    readOnly={!canUserEdit || isExecuting}
                                    onBlur={field.handleBlur}
                                    onChange={(content: Content) => {
                                        field.handleChange(content);
                                    }}
                                />
                            </div>
                        </>
                    )}
                </FormField>
            )}
            validators={{
                onChange: ({ value }) => {
                    const typedValue = value as ExecuteToolFormValues['parameters'];
                    const parsedCurrentValue = parseJsonIfValid(typedValue);

                    if (!parsedCurrentValue) {
                        return 'Parameters are required';
                    }

                    const requestBodySchemaError = validateRequestBodyWithToolParameters(
                        parsedCurrentValue,
                        toolParameters,
                    );

                    if (requestBodySchemaError) {
                        return requestBodySchemaError;
                    }

                    return null;
                },
            }}
        />
    </div>
);

export { ExecutionResult, CodeManagerExecutePanel };
