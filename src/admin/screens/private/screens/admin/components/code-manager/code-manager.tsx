import {
    BadgeCheckIcon,
    ChevronLeftIcon,
    PlayIcon,
    SaveIcon,
    OctagonAlertIcon,
    SlidersHorizontalIcon,
} from 'lucide-react';
import { useMemo, useState } from 'react';
import type React from 'react';

import { FloatingAssistant } from '@/admin/components/floating-assistant';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import SpinnerBlade from '@/components/ui/spinner';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

import type { Props, AnyFormFieldApi } from './code-manager.types';
import { langLabel } from './code-manager.utils';
import { pickCodeManagerConfig } from './components/ai-assistant-configs';
import CodeManagerEditor from './components/code-manager-editor';
import { CodeManagerExecutePanel, ExecutionResult } from './components/code-manager-execute';
import CodeManagerLoadingSkeleton from './components/code-manager-loading-skeleton';
import CodeManagerSidebar from './components/code-manager-sidebar';
import { useCodeManager } from './use-code-manager';
import './code-manager.scss';

const CodeManager = <T,>(props: Props<T>) => {
    const {
        type,
        lang,
        tool,
        agent,
        memory,
        category,
        categoryFieldName,
        categoryId,
        categoryIdFieldName,
        selectedToolCodeId,
        canUserEdit,
        isExecutable,
        onSubmit,
    } = props;

    const {
        selectedLang,
        setSelectedLang,
        toolCodes,
        selectedCodeId,
        loadingState,
        executionResult,
        codesQuery,
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
        fetchToolCodes,
        fetchLatestToolCodes,
        handleNewVersion,
        handleSelectCode,
        handleForkCode,
        handleSetAsDefault,
        handleSaveAndSetAsDefault,
        handleDeleteCode,
        fetchAgents,
        fetchDataStoresForSelect,
        fetchModelsForSelect,
    } = useCodeManager<T>({
        agent,
        memory,
        type,
        lang,
        tool,
        category,
        categoryFieldName,
        categoryId,
        categoryIdFieldName,
        selectedToolCodeId,
        onSubmit,
    });

    const [showExecutePanel, setShowExecutePanel] = useState(false);

    const isViewingDefaultVersion = !!(selectedToolCodeId && selectedCodeId && selectedToolCodeId === selectedCodeId);
    const isEditorReadOnly = isViewingDefaultVersion || !canUserEdit || isExecuting || isSubmitting;
    const shouldKeepReadOnlyTextVisible = isViewingDefaultVersion || !canUserEdit;

    const readOnlyReason: 'default-version' | 'no-permission' | null = (() => {
        if (!canUserEdit) return 'no-permission';
        if (isViewingDefaultVersion) return 'default-version';

        return null;
    })();

    const aiAssistantConfig = useMemo(
        () => pickCodeManagerConfig(selectedLang, type, categoryId ?? undefined),
        [categoryId, selectedLang, type],
    );

    const handleRequestFork = () => {
        const current = toolCodes.find((c) => c._id === selectedCodeId);

        if (!current) return;
        handleForkCode({ stopPropagation: () => {} } as React.MouseEvent<HTMLButtonElement>, current);
    };

    const handleLanguageTabChange = (value: string) => {
        if (isEditorReadOnly) return;

        if (selectedCodeId !== null) {
            form.handleSubmit();
        }

        setSelectedLang(value as (typeof lang)[number]);
    };

    if (loadingState.loading) {
        return (
            <CodeManagerLoadingSkeleton
                canUserEdit={canUserEdit}
                isHistoryPanelExpanded={isHistoryPanelExpanded}
                onToggleExpand={setIsHistoryPanelExpanded}
            />
        );
    }

    if (loadingState.error) {
        return (
            <div className="tab-content tool-tab code-manager-tab flex min-h-[400px] items-center justify-center">
                <div className="flex max-w-xs flex-col items-center gap-4 text-center">
                    <OctagonAlertIcon className="size-4 text-5xl! text-destructive!" />
                    <div className="flex flex-col gap-2">
                        <h3 className="text-base font-medium text-(--text-primary)">Failed to load code history</h3>
                        <span className="text-sm text-text-secondary">Network issue or data not found</span>
                        <Button
                            type="button"
                            variant="outline"
                            className="mt-2 min-w-[120px] justify-center rounded-full"
                            onClick={() => fetchToolCodes()}
                        >
                            Retry
                        </Button>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="tab-content tool-tab code-manager-tab flex h-full min-h-0 flex-col overflow-hidden p-0! max-lg:min-h-[calc(100svh-115px)]">
            <div className="flex min-h-0 flex-1 overflow-hidden rounded-none! p-0!">
                <CodeManagerSidebar
                    toolCodes={toolCodes}
                    selectedCodeId={selectedCodeId}
                    selectedToolCodeId={selectedToolCodeId}
                    canUserEdit={canUserEdit}
                    isHistoryPanelExpanded={isHistoryPanelExpanded}
                    isDeletingCode={isDeletingCode}
                    hasNextPage={codesQuery.hasNextPage}
                    isFetchingNextPage={codesQuery.isFetchingNextPage}
                    fetchNextPage={codesQuery.fetchNextPage}
                    onToggleExpand={setIsHistoryPanelExpanded}
                    onSelectCode={handleSelectCode}
                    onForkCode={handleForkCode}
                    onDeleteCode={handleDeleteCode}
                    onNewVersion={handleNewVersion}
                />

                <div className="flex min-h-0 min-w-0 flex-1 flex-col">
                    <div className="flex h-8 shrink-0 items-center justify-between gap-2 border-b border-border-secondary bg-(--bg-primary) px-4 py-1">
                        <div className="flex min-w-0 flex-1 items-center gap-2">
                            <div className="flex shrink-0 items-center gap-1">
                                {lang.length > 1 ? (
                                    <Tabs
                                        value={selectedLang}
                                        onValueChange={handleLanguageTabChange}
                                        className="gap-0"
                                    >
                                        <TabsList variant="line" className="p-0">
                                            {lang.map((l) => (
                                                <TabsTrigger
                                                    key={l}
                                                    value={l}
                                                    disabled={isEditorReadOnly}
                                                    className={cn(
                                                        'text-text-secondary',
                                                        'after:bg-primary data-[state=active]:text-primary',
                                                        'group-data-[orientation=horizontal]/tabs:after:bottom-0',
                                                        shouldKeepReadOnlyTextVisible &&
                                                            l === selectedLang &&
                                                            'disabled:text-primary disabled:opacity-100',
                                                    )}
                                                >
                                                    {langLabel(l)}
                                                </TabsTrigger>
                                            ))}
                                        </TabsList>
                                    </Tabs>
                                ) : (
                                    <Badge variant="secondary" className="lua-badge text-[10px] font-bold">
                                        {langLabel(selectedLang)}
                                    </Badge>
                                )}
                            </div>
                            <div className="h-3.5 w-px shrink-0 bg-border-secondary" />
                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                <form.Field
                                    name="version"
                                    children={(field: AnyFormFieldApi) => (
                                        <div className="flex w-full items-center gap-1.5">
                                            <span className="shrink-0 text-[10px] font-medium tracking-tight text-text-secondary uppercase">
                                                v:
                                            </span>
                                            <Input
                                                ref={versionInputRef}
                                                value={field.state.value}
                                                onChange={(e) => {
                                                    if (isEditorReadOnly) return;
                                                    field.handleChange(e.target.value);
                                                }}
                                                placeholder="1.0.0"
                                                className="h-6 max-w-[70px] px-1.5 py-0 text-xs font-medium"
                                                disabled={isExecuting || isSubmitting}
                                                readOnly={isEditorReadOnly}
                                                aria-readonly={isEditorReadOnly}
                                            />
                                        </div>
                                    )}
                                />
                            </div>
                        </div>

                        {!selectedCodeId && (
                            <Badge
                                variant="ghost"
                                className="new-badge h-5 gap-1 py-0 text-[10px] font-semibold uppercase"
                            >
                                <span className="relative flex h-1.5 w-1.5 shrink-0">
                                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-current opacity-75" />
                                    <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-current" />
                                </span>
                                New
                            </Badge>
                        )}

                        {isExecutable && (
                            <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => setShowExecutePanel(true)}
                                className="h-6 gap-1 px-2 text-xs lg:hidden"
                            >
                                <SlidersHorizontalIcon className="size-3" />
                                Configure
                            </Button>
                        )}

                        {canUserEdit && isExecutable && (
                            <Button
                                type="button"
                                size="sm"
                                onClick={executeForm.handleSubmit}
                                disabled={!selectedCodeId || isExecuting || isSavingAndSettingDefault}
                                className="h-6 gap-1 px-2 text-xs"
                            >
                                {isExecuting ? (
                                    <>
                                        <SpinnerBlade className="scale-75" />
                                        <span>Running</span>
                                    </>
                                ) : (
                                    <>
                                        <PlayIcon className="size-3" />
                                        <span>Run</span>
                                    </>
                                )}
                            </Button>
                        )}

                        {canUserEdit &&
                            selectedCodeId !== null &&
                            (selectedToolCodeId !== selectedCodeId ? (
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="h-6 gap-1 px-2 text-xs"
                                    disabled={isSavingAndSettingDefault}
                                    onClick={handleSetAsDefault}
                                >
                                    {isSettingDefault && !isSavingAndSettingDefault ? (
                                        <SpinnerBlade className="scale-75" />
                                    ) : (
                                        <BadgeCheckIcon className="size-3" />
                                    )}
                                    <span>Set as default</span>
                                </Button>
                            ) : (
                                <Badge variant="outline" className="h-6 py-0 text-[11px] uppercase">
                                    Default
                                </Badge>
                            ))}

                        {canUserEdit && (
                            <form.Subscribe
                                selector={(state) => [state.isDirty, state.canSubmit]}
                                children={([isDirty, canSubmit]) => (
                                    <Button
                                        type="button"
                                        size="sm"
                                        variant="outline"
                                        disabled={
                                            isEditorReadOnly ||
                                            (!isDirty && !!selectedCodeId) ||
                                            !canSubmit ||
                                            isSubmitting ||
                                            isSavingAndSettingDefault
                                        }
                                        onClick={form.handleSubmit}
                                        className="h-6 gap-1 px-2 text-xs"
                                    >
                                        {isSubmitting && !isSavingAndSettingDefault ? (
                                            <>
                                                <SpinnerBlade className="scale-75" />
                                                <span>{selectedCodeId ? 'Updating...' : 'Saving...'}</span>
                                            </>
                                        ) : (
                                            <>
                                                <SaveIcon className="size-3" />
                                                <span>{selectedCodeId ? 'Update' : 'Save'}</span>
                                            </>
                                        )}
                                    </Button>
                                )}
                            />
                        )}

                        {canUserEdit && (
                            <form.Subscribe
                                selector={(state) => state.canSubmit}
                                children={(canSubmit) => (
                                    <Button
                                        type="button"
                                        size="sm"
                                        disabled={
                                            isEditorReadOnly ||
                                            !canSubmit ||
                                            isSubmitting ||
                                            isSettingDefault ||
                                            isSavingAndSettingDefault
                                        }
                                        onClick={handleSaveAndSetAsDefault}
                                        className="h-6 gap-1 px-2 text-xs"
                                    >
                                        {isSavingAndSettingDefault ? (
                                            <>
                                                <SpinnerBlade className="scale-75" />
                                                <span>{selectedCodeId ? 'Updating...' : 'Saving...'}</span>
                                            </>
                                        ) : (
                                            <>
                                                <BadgeCheckIcon className="size-3" />
                                                <span>{selectedCodeId ? 'Update' : 'Save'} &amp; set default</span>
                                            </>
                                        )}
                                    </Button>
                                )}
                            />
                        )}
                    </div>

                    {!isExecutable ? (
                        <div className="editor-controller relative flex min-h-0 flex-1 flex-col overflow-hidden p-4">
                            <form.Field
                                name="code"
                                children={(field) => (
                                    <div className="tool-code-editor absolute inset-4 flex flex-col rounded-none!">
                                        <CodeManagerEditor
                                            field={field}
                                            selectedLang={selectedLang}
                                            isReadOnly={isEditorReadOnly}
                                            onChangeRef={() => {
                                                hasChangesRef.current = true;
                                            }}
                                            type={type}
                                            agent={agent}
                                            readOnlyReason={readOnlyReason}
                                            onRequestFork={handleRequestFork}
                                        />
                                    </div>
                                )}
                            />
                        </div>
                    ) : (
                        <div className="tool-code-with-execute relative flex min-h-0 flex-1 flex-row overflow-hidden">
                            {/* Code + response — full width on mobile, 60% on desktop */}
                            <div className="flex min-h-0 flex-1 flex-col lg:w-[60%]">
                                <div className="editor-controller relative flex min-h-0 flex-3 flex-col overflow-hidden">
                                    <form.Field
                                        name="code"
                                        children={(field) => (
                                            <div className="tool-code-editor absolute inset-0 flex min-h-0 flex-col rounded-none! border-0!">
                                                <CodeManagerEditor
                                                    field={field}
                                                    selectedLang={selectedLang}
                                                    isReadOnly={isEditorReadOnly}
                                                    onChangeRef={() => {
                                                        hasChangesRef.current = true;
                                                    }}
                                                />
                                            </div>
                                        )}
                                    />
                                </div>
                                <div className="scrollbar-controller scrollbar-vertical flex min-h-0 flex-2 flex-col border-t border-border-secondary bg-(--bg-primary) p-3">
                                    <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                                        <ExecutionResult executionResult={executionResult} isExecuting={isExecuting} />
                                    </div>
                                </div>
                            </div>

                            {/* Execute panel — static on desktop, slide-in overlay on tablet/mobile */}
                            <div className="hidden min-h-0 w-[40%] shrink-0 lg:flex">
                                <CodeManagerExecutePanel
                                    ExecuteFormField={ExecuteFormField}
                                    executionResult={executionResult}
                                    isExecuting={isExecuting}
                                    canUserEdit={canUserEdit}
                                    toolParameters={toolParameters}
                                    fetchAgents={fetchAgents}
                                    fetchDataStoresForSelect={fetchDataStoresForSelect}
                                    fetchModelsForSelect={fetchModelsForSelect}
                                />
                            </div>

                            {/* Slide-in execute panel — tablet/mobile only */}
                            <div
                                className={cn(
                                    'absolute inset-0 z-20 flex flex-col bg-card lg:hidden',
                                    'transition-transform duration-300 ease-in-out',
                                    showExecutePanel ? 'translate-x-0' : 'pointer-events-none translate-x-full',
                                )}
                            >
                                <div className="flex shrink-0 items-center gap-1 border-b border-border bg-card px-3 py-2">
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="sm"
                                        className="gap-1.5 text-text-secondary"
                                        onClick={() => setShowExecutePanel(false)}
                                    >
                                        <ChevronLeftIcon className="size-4" />
                                        Editor
                                    </Button>
                                </div>
                                <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                                    <CodeManagerExecutePanel
                                        ExecuteFormField={ExecuteFormField}
                                        executionResult={executionResult}
                                        isExecuting={isExecuting}
                                        canUserEdit={canUserEdit}
                                        toolParameters={toolParameters}
                                        fetchAgents={fetchAgents}
                                        fetchDataStoresForSelect={fetchDataStoresForSelect}
                                        fetchModelsForSelect={fetchModelsForSelect}
                                    />
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {aiAssistantConfig && !isEditorReadOnly && !loadingState.loading && !loadingState.error && (
                <FloatingAssistant
                    key={`${selectedLang}-${type}`}
                    config={aiAssistantConfig}
                    onFinish={fetchLatestToolCodes}
                />
            )}
        </div>
    );
};

export default CodeManager;
