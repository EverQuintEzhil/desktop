import { type ColumnDef, type ColumnSizingState, getCoreRowModel, useReactTable } from '@tanstack/react-table';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

import { useWizardExploreMutation } from '@/lib/api/admin/data-stores';

import { buildExplorerColumns } from '../explorer-columns';
import { getExplorerProviderVariants } from '../explorer-config';
import { buildExplorerRequestData, seedQueryValuesFromRequest } from '../explorer-query-helpers';
import type { DocumentRow, ExplorerConfig } from '../types';

export interface ExplorerQueryState {
    data: DocumentRow[];
    loading: boolean;
    error: boolean;
    pageIndex: number;
    pageSize: number;
    pages: number;
    totalCount: number;
    firstLoading: boolean;
}

export interface UseExplorerQueryResult {
    methodVariants: ExplorerConfig[];
    methodVariantIndex: number;
    setMethodVariantIndex: (index: number) => void;
    explorerConfig: ExplorerConfig;
    showMethodVariantSwitch: boolean;
    isSplitView: boolean;
    queryValues: Record<string, string>;
    setQueryField: (label: string, value: string) => void;
    resetQueryBar: () => void;
    fetchData: (values: Record<string, string>, pageIndex: number, pageSize: number) => Promise<void>;
    state: ExplorerQueryState;
    columns: ColumnDef<DocumentRow>[];
    columnSizing: ColumnSizingState;
    setColumnSizing: (sizing: ColumnSizingState) => void;
    explorerTable: ReturnType<typeof useReactTable<DocumentRow>>;
    expandedRows: Record<string, boolean>;
    toggleRow: (id: string) => void;
    total: number;
    rangeLabel: string;
    showEmptyFilterMessage: boolean;
    handlePageSizeChange: (val: number) => void;
    handlePageChange: (page: number) => void;
}

/**
 * Owns query-variant selection, the query field values, paginated result fetching, and the
 * TanStack table built from the results — the data side of the data explorer step.
 */
export function useExplorerQuery(
    dataStoreId: string | undefined,
    provider: string | undefined,
): UseExplorerQueryResult {
    const { mutateAsync: exploreMutateAsync } = useWizardExploreMutation();

    const methodVariants = useMemo(() => getExplorerProviderVariants(provider), [provider]);
    const [methodVariantIndex, setMethodVariantIndex] = useState(0);

    const explorerConfig = useMemo(
        () => methodVariants[methodVariantIndex] ?? methodVariants[0],
        [methodVariants, methodVariantIndex],
    );

    const showMethodVariantSwitch = methodVariants.length > 1;
    const isSplitView = explorerConfig.view === 'split';

    const [queryValues, setQueryValues] = useState<Record<string, string>>({});
    const [expandedRows, setExpandedRows] = useState<Record<string, boolean>>({});

    const [state, setState] = useState<ExplorerQueryState>({
        data: [],
        loading: true,
        error: false,
        pageIndex: 0,
        pageSize: 10,
        pages: 0,
        totalCount: 0,
        firstLoading: true,
    });
    const pageSizeRef = useRef(state.pageSize);

    pageSizeRef.current = state.pageSize;

    const fetchData = useCallback(
        async (values: Record<string, string>, pageIndex: number, pageSize: number) => {
            try {
                if (!dataStoreId) {
                    return;
                }

                const requestData = buildExplorerRequestData(explorerConfig, values, pageIndex, pageSize);

                if (requestData === null) {
                    return;
                }

                setState((prevState) => ({
                    ...prevState,
                    loading: true,
                }));

                const result = await exploreMutateAsync({
                    id: dataStoreId,
                    data: requestData,
                });

                const explorerResult = result as {
                    values?: unknown[];
                    page_info?: { page?: number; size?: number; total_pages?: number; total_count?: number };
                    request?: Record<string, unknown>;
                } | null;

                if (explorerResult?.values) {
                    const pageInfo = explorerResult.page_info;
                    const requestEcho = explorerResult.request;

                    setState((prevState) => ({
                        ...prevState,
                        data: explorerResult.values as DocumentRow[],
                        pageIndex: pageInfo?.page ?? pageIndex,
                        pageSize: pageInfo?.size ?? pageSize,
                        pages: pageInfo?.total_pages ?? prevState.pages,
                        totalCount: pageInfo?.total_count ?? explorerResult.values!.length,
                        loading: false,
                        firstLoading: false,
                        error: false,
                    }));

                    if (requestEcho) {
                        setQueryValues((prev) => seedQueryValuesFromRequest(prev, requestEcho, explorerConfig.fields));
                    }
                }
            } catch (error) {
                console.error(error);
                setState((prevState) => ({
                    ...prevState,
                    error: true,
                    firstLoading: false,
                    loading: false,
                }));
            }
        },
        [dataStoreId, exploreMutateAsync, explorerConfig],
    );

    useEffect(() => {
        setMethodVariantIndex(0);
    }, [provider]);

    useEffect(() => {
        if (!dataStoreId) {
            return;
        }

        const next: Record<string, string> = {};

        for (const f of explorerConfig.fields) {
            next[f.label] = '';
        }

        setQueryValues(next);
        setState((prev) => ({
            ...prev,
            pageIndex: 0,
            loading: true,
        }));
        fetchData(next, 0, pageSizeRef.current);
        // explorerConfig is intentionally omitted: methodVariantIndex already captures which
        // variant is active, and including the (recomputed) config object would re-run this on
        // every render.
    }, [dataStoreId, provider, methodVariantIndex, fetchData]);

    const toggleRow = useCallback((id: string) => {
        setExpandedRows((prev) => ({
            ...prev,
            [id]: !prev[id],
        }));
    }, []);

    const columns = useMemo(
        (): ColumnDef<DocumentRow>[] =>
            buildExplorerColumns({
                data: state.data,
                expandedRows,
                toggleRow,
            }),
        [expandedRows, toggleRow, state.data],
    );

    const [columnSizing, setColumnSizing] = useState<ColumnSizingState>({});

    const explorerTable = useReactTable({
        data: state.data,
        columns,
        getCoreRowModel: getCoreRowModel(),
        columnResizeMode: 'onChange',
        enableColumnResizing: true,
        defaultColumn: {
            minSize: 72,
            maxSize: 640,
            size: 150,
        },
        state: {
            columnSizing,
        },
        onColumnSizingChange: setColumnSizing,
    });

    const total = state.totalCount;
    const shown = state.data.length;
    const start = total === 0 ? 0 : state.pageIndex * state.pageSize + 1;
    const end = total === 0 ? 0 : Math.min(state.pageIndex * state.pageSize + shown, total);
    const rangeLabel = `${start} - ${end}`;

    const showEmptyFilterMessage = state.data.length === 0 && !state.loading;

    const setQueryField = useCallback((label: string, value: string) => {
        setQueryValues((prev) => ({
            ...prev,
            [label]: value,
        }));
    }, []);

    const resetQueryBar = useCallback(() => {
        if (!dataStoreId) {
            return;
        }

        const next: Record<string, string> = {};

        for (const f of explorerConfig.fields) {
            next[f.label] = '';
        }

        setQueryValues(next);
        setState((prev) => ({
            ...prev,
            pageIndex: 0,
            loading: true,
        }));
        fetchData(next, 0, state.pageSize);
    }, [dataStoreId, explorerConfig.fields, fetchData, state.pageSize]);

    const handlePageSizeChange = useCallback(
        (val: number) => {
            setState((prev) => ({
                ...prev,
                pageIndex: 0,
                pageSize: val,
                loading: true,
            }));
            fetchData(queryValues, 0, val);
        },
        [fetchData, queryValues],
    );

    const handlePageChange = useCallback(
        (page: number) => {
            const nextPage = page - 1;

            setState((prev) => ({
                ...prev,
                pageIndex: nextPage,
                loading: true,
            }));
            fetchData(queryValues, nextPage, state.pageSize);
        },
        [fetchData, queryValues, state.pageSize],
    );

    return {
        methodVariants,
        methodVariantIndex,
        setMethodVariantIndex,
        explorerConfig,
        showMethodVariantSwitch,
        isSplitView,
        queryValues,
        setQueryField,
        resetQueryBar,
        fetchData,
        state,
        columns,
        columnSizing,
        setColumnSizing,
        explorerTable,
        expandedRows,
        toggleRow,
        total,
        rangeLabel,
        showEmptyFilterMessage,
        handlePageSizeChange,
        handlePageChange,
    };
}
