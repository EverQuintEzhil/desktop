import type { Content } from 'vanilla-jsoneditor';

import { ConnectionOptionTabs } from '@/admin/screens/private/screens/admin/components/data-stores/components/wizard-pages/configure-connection-step/connection-option-tabs';
import {
    type ConnectionProviderOption,
    connectionCoerceNestedValues,
    connectionFirstFieldErrorFromErrorMap,
    connectionFlattenToLeaves,
    connectionGetNestedValue,
    connectionGetValueType,
    connectionToLabel,
} from '@/admin/screens/private/screens/admin/components/data-stores/components/wizard-pages/configure-connection-step/connection-utils';
import JSONEditor from '@/components/json-editor';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import { useListCollectionsMutation } from '@/lib/api/admin/data-stores';
import { getApiErrorMessage } from '@/lib/api/get-api-error-message';
import { dataStoreCollectionToOption, showErrorToast } from '@/utils';

import type { DataStoreForm } from '../hooks';

export interface ConnectionFieldsSectionProps {
    form: DataStoreForm;
    selectedProvider: string | undefined;
    providerOptions: ConnectionProviderOption[];
    activeOptionIndex: number;
    onActiveOptionIndexChange: (index: number) => void;
    connectionValues: Record<string, unknown>;
}

const SELECT_FIELD_LOADING_TEXT: Record<string, string> = {
    collection: 'Fetching collections',
    table: 'Fetching tables',
    index: 'Fetching indexes',
    operationId: 'Fetching operations',
};

/** Connection fields for providers other than files, custom and weblinks. */
const ConnectionFieldsSection = ({
    form,
    selectedProvider,
    providerOptions,
    activeOptionIndex,
    onActiveOptionIndexChange,
    connectionValues,
}: ConnectionFieldsSectionProps) => {
    const listCollectionsMutation = useListCollectionsMutation();
    const activeFields = providerOptions[activeOptionIndex]?.config ?? {};
    const leaves = connectionFlattenToLeaves(activeFields);

    return (
        <>
            <div className="flex flex-col gap-3 border-t border-border pt-3">
                <Label className="text-sm text-[11px] font-semibold tracking-wider text-text-secondary uppercase">
                    Connection
                </Label>
                <ConnectionOptionTabs
                    options={providerOptions}
                    activeIndex={activeOptionIndex}
                    onChange={onActiveOptionIndexChange}
                />
            </div>
            {leaves.map(({ path, value, required, otherFieldsShouldComplete, derivedFromUrl, sensitive }) => {
                const valueType = connectionGetValueType(value);
                const label = connectionToLabel(path);
                const fieldName = `connection.${path}` as never;

                const requiredValidator = ({ value: v }: { value: unknown }) => {
                    if (required && (!v || String(v).trim() === '')) {
                        return `${label} is required`;
                    }

                    return undefined;
                };

                return (
                    <form.Field
                        key={`${selectedProvider}-${activeOptionIndex}-${path}`}
                        name={fieldName}
                        validators={{
                            onBlur: requiredValidator,
                            onSubmit: requiredValidator,
                            ...(valueType === 'select' ? { onChange: requiredValidator } : {}),
                        }}
                    >
                        {(field) => {
                            const fieldValue = (field.state.value as string) ?? '';
                            const fieldError = connectionFirstFieldErrorFromErrorMap(
                                field.state.meta.errorMap as Record<string, unknown> | undefined,
                            );

                            if (valueType === 'boolean') {
                                return (
                                    <Checkbox
                                        checked={fieldValue === 'true'}
                                        label={label}
                                        disabled={derivedFromUrl === true}
                                        onChange={(_, checked) => field.handleChange(String(checked) as never)}
                                    />
                                );
                            }

                            if (valueType === 'json') {
                                return (
                                    <div className="flex flex-col gap-1">
                                        <Label className="text-sm font-medium text-text-secondary">
                                            {label}
                                            {required && <span className="ml-0.5 text-destructive">*</span>}
                                        </Label>
                                        <JSONEditor
                                            content={{ text: fieldValue }}
                                            onBlur={field.handleBlur}
                                            containerClassName="max-h-[200px] flex flex-col overflow-hidden scrollbar-controller scrollbar-vertical"
                                            onChange={(content: Content) => {
                                                const text =
                                                    'text' in content ? content.text : JSON.stringify(content.json);

                                                field.handleChange(text as never);
                                            }}
                                        />
                                        {fieldError && <span className="text-xs text-destructive">{fieldError}</span>}
                                    </div>
                                );
                            }

                            if (valueType === 'select') {
                                const otherNonSelectLeaves = leaves.filter(
                                    (l) => l.path !== path && connectionGetValueType(l.value) !== 'select',
                                );
                                const allRequiredComplete =
                                    !otherFieldsShouldComplete ||
                                    otherNonSelectLeaves
                                        .filter((l) => l.required)
                                        .every(({ path: p }) => {
                                            const v = connectionGetNestedValue(connectionValues, p);

                                            return v && String(v).trim() !== '';
                                        });
                                const loadingText = SELECT_FIELD_LOADING_TEXT[path.split('.').pop() ?? path];
                                const dependencyKey = otherNonSelectLeaves
                                    .map((l) => String(connectionGetNestedValue(connectionValues, l.path) ?? ''))
                                    .join('|');

                                const fetchSelectOptions = async (query: string, pageNo: number = 0) => {
                                    try {
                                        const connection = connectionCoerceNestedValues(connectionValues, activeFields);

                                        leaves
                                            .filter((l) => connectionGetValueType(l.value) === 'select')
                                            .forEach(({ path: p }) => {
                                                const key = p.split('.').pop();

                                                if (key) delete (connection as Record<string, unknown>)[key];
                                            });

                                        const result = await listCollectionsMutation.mutateAsync({
                                            params: {
                                                page: pageNo,
                                                size: 20,
                                                search: query?.trim() || '',
                                            },
                                            data: {
                                                provider: selectedProvider as string,
                                                connection,
                                            },
                                        });

                                        return {
                                            list: result.values.map(dataStoreCollectionToOption),
                                            pageInfo: {
                                                page: result.pageInfo.page,
                                                total_pages: result.pageInfo.totalPages,
                                            },
                                        };
                                    } catch (error) {
                                        showErrorToast(
                                            getApiErrorMessage(
                                                error,
                                                'Failed to fetch options. Please check the connection and try again.',
                                            ),
                                        );

                                        return { list: [], pageInfo: { page: 0, total_pages: 0 } };
                                    }
                                };

                                return (
                                    <div className="flex flex-col gap-1">
                                        <Label className="text-sm font-medium text-text-secondary">
                                            {label}
                                            {required && <span className="ml-0.5 text-destructive">*</span>}
                                        </Label>
                                        <Select
                                            key={dependencyKey}
                                            variant="ghost"
                                            className="h-10 bg-card"
                                            placeholder={
                                                allRequiredComplete ? 'Select...' : 'Complete other fields first'
                                            }
                                            options={allRequiredComplete ? fetchSelectOptions : []}
                                            loadingText={loadingText}
                                            value={fieldValue || null}
                                            disabled={!allRequiredComplete}
                                            onChange={(val) => {
                                                void (async () => {
                                                    field.setValue(val as never, { dontValidate: true });
                                                    await field.validate('change');
                                                    if (val != null && String(val).trim() !== '') {
                                                        form.setFieldMeta(fieldName, (prev) => ({
                                                            ...prev,
                                                            errorMap: {},
                                                            errorSourceMap: {},
                                                        }));
                                                    }
                                                })();
                                            }}
                                            allowSearch={true}
                                        />
                                        {fieldError && <span className="text-xs text-destructive">{fieldError}</span>}
                                    </div>
                                );
                            }

                            let inputType = 'text';

                            if (valueType === 'number') inputType = 'number';
                            else if (sensitive) inputType = 'password';

                            return (
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-sm font-medium text-text-secondary">
                                        {label}
                                        {required && <span className="ml-0.5 text-destructive">*</span>}
                                    </Label>
                                    <Input
                                        type={inputType}
                                        value={fieldValue}
                                        onBlur={field.handleBlur}
                                        onChange={(e) => field.handleChange(e.target.value as never)}
                                        className="h-10 bg-card"
                                    />
                                    {fieldError && <span className="text-xs text-destructive">{fieldError}</span>}
                                </div>
                            );
                        }}
                    </form.Field>
                );
            })}
        </>
    );
};

export default ConnectionFieldsSection;
