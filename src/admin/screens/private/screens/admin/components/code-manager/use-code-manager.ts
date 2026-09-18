import { useForm } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { isAxiosError } from 'axios';
import { useEffect, useMemo, useState, useCallback, useRef, type ReactElement } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import type { SelectSuggestionItem } from '@/components/ui/select';
import { adminAgentsApi } from '@/lib/api/admin/agents';
import {
    adminCodeManagerApi,
    useCodeListInfiniteQuery,
    useCreateCodeMutation,
    useUpdateCodeMutation,
    useDeleteCodeMutation,
    useCodeManagerUpdateEntityMutation,
    useExecuteToolMutation,
} from '@/lib/api/admin/code-manager';
import {
    adminDataStoresApi,
    DATA_STORES_LIST_QUERY_KEY,
    type DataStoresQueryParams,
} from '@/lib/api/admin/data-stores';
import { adminModelsApi, MODELS_LIST_QUERY_KEY, type ModelsQueryParams } from '@/lib/api/admin/models';
import {
    modelDisplayName,
    type CodeType,
    type CodeTypeEnum,
    type CodeLangEnum,
    type AgentType,
    type DataStoreType,
    type ToolType,
    type ModelType,
    type MemoryType,
} from '@/types/admin';
import { parseJsonIfValid, showErrorToast, showSuccessToast } from '@/utils';

import {
    getUiConfigModelValidationError,
    validateUiConfigCode,
} from '../agents/components/agent-detail/components/agent-ui-config-editor/validation';
import type { ToolParameterSchema } from '../parameters-schema/tool-parameter-schema.types';

import type { ExecuteToolFormValues, ExecuteFormFieldProps } from './code-manager.types';
import {
    buildRequestBodyFromParameterSchema,
    getAgentModelConfigValidationError,
    stringifyAgentModelConfigDefaults,
    validateRequestBodyWithToolParameters,
} from './code-manager.utils';

interface UseCodeManagerParams<T> {
    type: CodeTypeEnum;
    lang: CodeLangEnum[];
    agent?: AgentType;
    tool?: ToolType;
    memory?: MemoryType;
    category: string;
    categoryFieldName: string;
    categoryId: string;
    categoryIdFieldName: string;
    selectedToolCodeId: string | null;
    onSubmit: (value: T) => void;
}

const getNextVersion = (codes: CodeType[]): string => {
    const parsed = codes
        .map((c) => c.version.split('.').map(Number))
        .filter((parts) => parts.length === 3 && parts.every((n) => !isNaN(n)));

    if (parsed.length === 0) return '1.0.0';

    const max = parsed.reduce((best, curr) => {
        for (let i = 0; i < 3; i++) {
            if (curr[i] > best[i]) return curr;
            if (curr[i] < best[i]) return best;
        }

        return best;
    });

    return `${max[0]}.${max[1]}.${max[2] + 1}`;
};

export const useCodeManager = <T>({
    agent,
    type,
    lang,
    tool,
    category,
    categoryFieldName,
    categoryId,
    categoryIdFieldName,
    selectedToolCodeId: _selectedToolCodeId,
    onSubmit,
}: UseCodeManagerParams<T>) => {
    const queryClient = useQueryClient();
    const [selectedLang, setSelectedLang] = useState<CodeLangEnum>(lang[0]);
    const [selectedCodeId, setSelectedCodeId] = useState<string | null>(null);
    const [isCodeSelectionHydrated, setIsCodeSelectionHydrated] = useState(false);

    const selectedCodeIdRef = useRef(selectedCodeId);

    selectedCodeIdRef.current = selectedCodeId;

    const prevCategoryIdRef = useRef<string | null>(null);
    const prevDataUpdatedAtRef = useRef<number | undefined>(undefined);
    const [executionResult, setExecutionResult] = useState<{
        executed: boolean;
        error: string | null;
        errorName: string | null;
        luaErrorObject: Record<string, unknown> | null;
        data: unknown;
    } | null>(null);
    const [isDeletingCode, setIsDeletingCode] = useState('');
    const [isSavingAndSettingDefault, setIsSavingAndSettingDefault] = useState(false);
    const [isHistoryPanelExpanded, setIsHistoryPanelExpanded] = useState(
        () => window.matchMedia('(min-width: 1024px)').matches,
    );

    const hasChangesRef = useRef(false);
    const versionInputRef = useRef<HTMLInputElement>(null);

    const codesQuery = useCodeListInfiniteQuery(categoryId, categoryIdFieldName, [type]);
    const createCodeMutation = useCreateCodeMutation();
    const updateCodeMutation = useUpdateCodeMutation();
    const deleteCodeMutation = useDeleteCodeMutation();
    const updateEntityMutation = useCodeManagerUpdateEntityMutation();
    const executeToolMutation = useExecuteToolMutation();

    const isSubmitting = createCodeMutation.isPending || updateCodeMutation.isPending;
    const isExecuting = executeToolMutation.isPending;
    const isSettingDefault = updateEntityMutation.isPending;

    const toolParameters = tool?.parameters as ToolParameterSchema | undefined;

    const toolCodes = useMemo(() => {
        return codesQuery.data?.pages.flatMap((page) => page.values) ?? [];
    }, [codesQuery.data?.pages]);

    const form = useForm({
        defaultValues: { code: '', version: '1.0.0' },
        onSubmit: async ({ value }) => {
            onSave(value);
        },
    });

    useEffect(() => {
        if (codesQuery.isPending) {
            setIsCodeSelectionHydrated(false);
        }
    }, [codesQuery.isPending]);

    useEffect(() => {
        if (!codesQuery.isSuccess || codesQuery.isPending) return;

        const categoryChanged = prevCategoryIdRef.current !== categoryId;
        const dataChanged = prevDataUpdatedAtRef.current !== codesQuery.dataUpdatedAt;

        prevCategoryIdRef.current = categoryId;
        prevDataUpdatedAtRef.current = codesQuery.dataUpdatedAt;

        if (!categoryChanged && !dataChanged) return;

        const codes = toolCodes;

        if (codes.length > 0) {
            const sel = selectedCodeIdRef.current;
            const toSelect = sel && codes.some((c) => c._id === sel) ? codes.find((c) => c._id === sel)! : codes[0];

            setSelectedCodeId(toSelect._id);
            setSelectedLang(toSelect.lang);
            form.setFieldValue('code', toSelect.code);
            form.setFieldValue('version', toSelect.version);
            hasChangesRef.current = false;
        } else {
            if (agent && type === 'agent_model_config') {
                form.setFieldValue('code', stringifyAgentModelConfigDefaults(agent.models));
            } else {
                form.setFieldValue('code', '');
            }
            setSelectedCodeId(null);
            form.setFieldValue('version', '1.0.0');
            hasChangesRef.current = false;
        }
        setIsCodeSelectionHydrated(true);
    }, [codesQuery.isSuccess, codesQuery.isPending, codesQuery.dataUpdatedAt, categoryId, toolCodes]);

    const loadingState = {
        loading: codesQuery.isPending || (codesQuery.isSuccess && !isCodeSelectionHydrated),
        error: codesQuery.isError,
    };

    const refetchToolCodes = useCallback(() => {
        void codesQuery.refetch();
    }, [codesQuery]);

    const refetchLatestToolCodes = useCallback(() => {
        selectedCodeIdRef.current = null;
        setSelectedCodeId(null);
        void codesQuery.refetch();
    }, [codesQuery]);

    const onSave = async (value: { code: string; version: string }): Promise<string | null> => {
        if (isSubmitting) return null;

        try {
            const isNew = !selectedCodeId;
            let codeToSave = value.code;
            const selectedCode = !isNew ? toolCodes.find((c) => c._id === selectedCodeId) : null;

            if (type === 'agent_ui_config') {
                const validation = validateUiConfigCode(value.code);

                if (!validation.success) {
                    showErrorToast(validation.message);

                    return null;
                }

                if (agent) {
                    const modelError = getUiConfigModelValidationError(validation.data, agent.models);

                    if (modelError) {
                        showErrorToast(modelError);

                        return null;
                    }
                }

                codeToSave = JSON.stringify(validation.data, null, 2);
            }

            if (agent && type === 'agent_model_config') {
                const parsedConfig = parseJsonIfValid({ text: codeToSave });
                const validationError = getAgentModelConfigValidationError(parsedConfig, agent.models);

                if (validationError) {
                    showErrorToast(validationError);

                    return null;
                }
            }

            const payload = isNew
                ? {
                      code: codeToSave,
                      type,
                      lang: selectedLang,
                      version: value.version || '1.0.0',
                      [categoryIdFieldName ?? 'toolId']: categoryId,
                  }
                : {
                      code: codeToSave,
                      version: value.version,
                      lang: selectedLang !== selectedCode?.lang ? selectedLang : undefined,
                  };

            if (codeToSave.trim() === '') {
                showErrorToast('Code is required');

                return null;
            }

            const savedCode = isNew
                ? await createCodeMutation.mutateAsync(payload)
                : await updateCodeMutation.mutateAsync({ id: selectedCodeId!, data: payload });

            setSelectedCodeId(savedCode._id);
            form.setFieldValue('code', codeToSave);

            if (isNew && toolCodes.length === 0) {
                const response = await adminCodeManagerApi.getEntity<T>(category, categoryId);

                onSubmit(response);
            }
            hasChangesRef.current = false;
            showSuccessToast('Code saved successfully');

            return savedCode._id;
        } catch (error) {
            console.error('Failed to save tool code', error);

            return null;
        }
    };

    const handleNewVersion = () => {
        setSelectedCodeId(null);
        setSelectedLang(lang[0]);
        if (agent && type === 'agent_model_config') {
            form.setFieldValue('code', stringifyAgentModelConfigDefaults(agent.models));
        } else {
            form.setFieldValue('code', '');
        }
        form.setFieldValue('version', getNextVersion(toolCodes));
        hasChangesRef.current = false;
        setIsCodeSelectionHydrated(true);
        requestAnimationFrame(() => versionInputRef.current?.focus());
    };

    const handleSelectCode = (code: CodeType) => {
        setSelectedCodeId(code._id);
        setSelectedLang(code.lang);
        form.setFieldValue('code', code.code);
        form.setFieldValue('version', code.version);
        hasChangesRef.current = false;
        setIsCodeSelectionHydrated(true);
    };

    const handleForkCode = (e: React.MouseEvent<HTMLButtonElement>, code: CodeType) => {
        e.stopPropagation();
        setSelectedCodeId(null);
        setSelectedLang(code.lang);
        form.setFieldValue('code', code.code);
        form.setFieldValue('version', getNextVersion(toolCodes));
        hasChangesRef.current = false;
        setIsCodeSelectionHydrated(true);
        requestAnimationFrame(() => versionInputRef.current?.focus());
    };

    const handleDeleteCode = async (code: CodeType) => {
        try {
            setIsDeletingCode(code._id);
            await deleteCodeMutation.mutateAsync(code._id);

            if (selectedCodeId === code._id) {
                setSelectedCodeId(null);

                form.setFieldValue('code', '');
                form.setFieldValue('version', getNextVersion(toolCodes.filter((c) => c._id !== code._id)));
                hasChangesRef.current = false;
                setIsCodeSelectionHydrated(true);
                requestAnimationFrame(() => versionInputRef.current?.focus());
            }
            showSuccessToast('This version of code deleted successfully');
        } catch (error) {
            console.error('Failed to use current version', error);
            showErrorToast('Failed to delete this version of code');
        } finally {
            setIsDeletingCode('');
        }
    };

    const handleSetAsDefault = async () => {
        if (!selectedCodeId) return;

        try {
            let codeId: string | null = selectedCodeId;

            if (hasChangesRef.current) {
                codeId = await onSave(form.state.values);
            }

            if (!codeId) return;

            const response = await updateEntityMutation.mutateAsync({
                category,
                categoryId,
                data: { [categoryFieldName]: codeId },
            });

            onSubmit(response as T);
            showSuccessToast('This version set as default successfully');
        } catch (error) {
            console.error('Failed to use current version', error);
        }
    };

    const handleSaveAndSetAsDefault = async () => {
        setIsSavingAndSettingDefault(true);
        try {
            const codeId = hasChangesRef.current || !selectedCodeId ? await onSave(form.state.values) : selectedCodeId;

            if (!codeId) return;

            const response = await updateEntityMutation.mutateAsync({
                category,
                categoryId,
                data: { [categoryFieldName]: codeId },
            });

            onSubmit(response as T);
            showSuccessToast('This version saved and set as default successfully');
        } catch (error) {
            console.error('Failed to save and set as default', error);
        } finally {
            setIsSavingAndSettingDefault(false);
        }
    };

    const onExecute = async (value: ExecuteToolFormValues) => {
        try {
            if (hasChangesRef.current) {
                await onSave(form.state.values);
            }

            setExecutionResult(null);

            const finalRequestBody = parseJsonIfValid(value.parameters);
            const requestBodySchemaError = validateRequestBodyWithToolParameters(finalRequestBody, toolParameters);

            if (requestBodySchemaError) {
                showErrorToast(requestBodySchemaError);

                return;
            }

            const obj = {
                parameters: finalRequestBody,
                agentIds: value.agentIds.map((store) => store.value),
                datastoreIds: value.dataStoreIds.map((store) => store.value),
                modelIds: value.modelIds.map((model) => model.value),
                codeId: selectedCodeId ?? '',
            };

            if (tool) {
                const response = await executeToolMutation.mutateAsync({ toolId: tool._id, data: obj });

                setExecutionResult({
                    executed: true,
                    error: null,
                    errorName: null,
                    luaErrorObject: null,
                    data: response ?? null,
                });
            }
        } catch (error: unknown) {
            console.error(error);
            type LuaError = {
                type?: unknown;
                message?: unknown;
                line?: unknown;
                sourceContext?: unknown[];
                luaStack?: unknown[];
                raw?: unknown;
            };
            type ErrorResponseData = {
                message?: unknown;
                error?: { message?: unknown; name?: unknown; luaError?: LuaError };
            };

            const responseData =
                isAxiosError(error) &&
                error.response?.data &&
                typeof error.response.data === 'object' &&
                error.response.data !== null
                    ? (error.response.data as ErrorResponseData)
                    : null;

            const nestedErrorMsg =
                responseData?.error && typeof responseData.error === 'object' && responseData.error.message
                    ? String(responseData.error.message)
                    : null;

            const errorName =
                responseData?.error && typeof responseData.error === 'object' && responseData.error.name
                    ? String(responseData.error.name)
                    : null;

            const luaErrorObject =
                responseData?.error && typeof responseData.error === 'object' && responseData.error.luaError
                    ? (responseData.error.luaError as Record<string, unknown>)
                    : null;

            const topLevelMsg = responseData?.message ? String(responseData.message) : null;

            const errorMessage =
                nestedErrorMsg ??
                topLevelMsg ??
                (error instanceof Error ? error.message : null) ??
                'Failed to execute tool';

            setExecutionResult({
                executed: true,
                error: errorMessage,
                errorName,
                luaErrorObject,
                data: null,
            });
        }
    };

    const defaultDataStores = useMemo(
        () => tool?.dataStores?.map((store) => ({ value: store._id, label: store.name })) ?? [],
        [tool?.dataStores],
    );

    const defaultModels = useMemo(
        () => tool?.models?.map((store) => ({ value: store._id, label: modelDisplayName(store) })) ?? [],
        [tool?.models],
    );

    const defaultAgentIds = useMemo(
        () => tool?.agents?.map((agent) => ({ value: agent._id, label: agent.name })) ?? [],
        [tool?.agents],
    );

    const executeForm = useForm({
        defaultValues: {
            parameters: { json: buildRequestBodyFromParameterSchema(toolParameters) } as Content,
            agentIds: defaultAgentIds as SelectSuggestionItem<string>[],
            dataStoreIds: defaultDataStores as SelectSuggestionItem<string>[],
            modelIds: defaultModels as SelectSuggestionItem<string>[],
        } as ExecuteToolFormValues,
        onSubmit: async ({ value }) => {
            onExecute(value);
        },
        onSubmitInvalid: () => {
            showErrorToast('Please fix form errors before executing.');
        },
    });

    useEffect(() => {
        if (!tool) return;
        executeForm.setFieldValue('agentIds', defaultAgentIds);
        executeForm.setFieldValue('dataStoreIds', defaultDataStores);
        executeForm.setFieldValue('modelIds', defaultModels);
    }, [tool?.agents, tool?.dataStores, tool?.models]);

    const ExecuteFormField = executeForm.Field as unknown as (props: ExecuteFormFieldProps) => ReactElement;

    const fetchAgents = async (query: string, pageNo: number = 0) => {
        const response = await adminAgentsApi.list({ page: pageNo, size: 20, search: query });
        const list = response.values;

        return list.map((val: AgentType) => ({ value: val._id, label: val.name }));
    };

    const fetchDataStoresForSelect = async (query: string) => {
        const params: DataStoresQueryParams = {
            pageIndex: 0,
            pageSize: 20,
            search: query,
            sort: [],
        };
        const response = await queryClient.fetchQuery({
            queryKey: [...DATA_STORES_LIST_QUERY_KEY, params],
            queryFn: () =>
                adminDataStoresApi.list({
                    page: params.pageIndex,
                    size: params.pageSize,
                    search: params.search,
                    sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
                }),
        });
        const list = response.values;

        return list.map((val: DataStoreType) => ({ value: val._id, label: val.name }));
    };

    const fetchModelsForSelect = async (query: string) => {
        const params: ModelsQueryParams = {
            pageIndex: 0,
            pageSize: 20,
            search: query,
            sort: [],
        };
        const response = await queryClient.fetchQuery({
            queryKey: [...MODELS_LIST_QUERY_KEY, params],
            queryFn: () =>
                adminModelsApi.list({
                    page: params.pageIndex,
                    size: params.pageSize,
                    search: params.search,
                    sortBy: params.sort.map((s) => `${s.id}:${s.desc ? 'desc' : 'asc'}`),
                }),
        });
        const list = response.values;

        return list.map((val: ModelType) => ({ value: val._id, label: modelDisplayName(val) }));
    };

    return {
        selectedLang,
        setSelectedLang,
        toolCodes,
        selectedCodeId,
        loadingState,
        codesQuery,
        executionResult,
        isSubmitting,
        isExecuting,
        isSettingDefault,
        isSavingAndSettingDefault,
        isDeletingCode,
        isHistoryPanelExpanded,
        setIsHistoryPanelExpanded,
        hasChangesRef,
        versionInputRef,
        toolParameters,
        form,
        executeForm,
        ExecuteFormField,
        fetchToolCodes: refetchToolCodes,
        fetchLatestToolCodes: refetchLatestToolCodes,
        onSave,
        handleNewVersion,
        handleSelectCode,
        handleForkCode,
        handleDeleteCode,
        handleSetAsDefault,
        handleSaveAndSetAsDefault,
        fetchAgents,
        fetchDataStoresForSelect,
        fetchModelsForSelect,
    };
};
