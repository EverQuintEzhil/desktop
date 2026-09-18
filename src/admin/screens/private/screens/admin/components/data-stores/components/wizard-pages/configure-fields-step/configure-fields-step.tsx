import { PanelTopIcon, PanelBottomIcon, SearchIcon } from 'lucide-react';
import { Fragment, forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import type { WizardFormPageHandle, WizardFormPageProps } from '@/admin/components/wizard';
import JSONEditor from '@/components/json-editor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import SpinnerBlade from '@/components/ui/spinner';
import {
    useWizardFieldsQuery,
    useWizardSaveCronMutation,
    useWizardSaveEmbeddingConfigMutation,
} from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';
import type { DataStoreType } from '@/types/admin';
import { showErrorToast } from '@/utils';

import '../../data-stores-detail/components/data-stores-fields/data-stores-fields.scss';

import { FIELDS_STEPS, flattenSchema, getFieldsTypeBadgeClass, setsEqualString } from './schema-helpers';

export const ConfigureFieldsStep = forwardRef<WizardFormPageHandle, WizardFormPageProps>(
    ({ currentPage, setCanGoNext, onPageComplete, handleCommonDataChange, commonData }, ref) => {
        const saveCronMutation = useWizardSaveCronMutation();
        const saveEmbeddingMutation = useWizardSaveEmbeddingConfigMutation();

        const [formError, setFormError] = useState('');
        const [jsonPanelExpanded, setJsonPanelExpanded] = useState(false);

        const wizardData = commonData as {
            dataStore?: DataStoreType;
            completedPages?: number[];
            dontSkipCron?: boolean;
            requestCronChoice?: () => void;
        } | null;
        const dataStore = wizardData?.dataStore;

        const wizardFieldsQuery = useWizardFieldsQuery(dataStore?._id);
        const fields = {
            data: wizardFieldsQuery.data ?? null,
            loading: wizardFieldsQuery.isPending,
            error: wizardFieldsQuery.isError,
        };
        const [step, setStep] = useState<1 | 2>(1);
        const [embeddingFields, setEmbeddingFields] = useState<Set<string>>(
            dataStore?.embeddingConfig?.embeddingFields
                ? new Set(dataStore.embeddingConfig.embeddingFields)
                : new Set(),
        );
        const [metadataFields, setMetadataFields] = useState<Set<string>>(
            dataStore?.embeddingConfig?.metadataFields ? new Set(dataStore.embeddingConfig.metadataFields) : new Set(),
        );
        const [search, setSearch] = useState('');

        const isAlreadyAdded = wizardData?.completedPages?.includes(currentPage);

        const stepRef = useRef(step);

        stepRef.current = step;

        useEffect(() => {
            const canAdvance = step === 1 ? embeddingFields.size > 0 : metadataFields.size > 0;

            setCanGoNext(canAdvance);
        }, [step, embeddingFields, metadataFields, setCanGoNext]);

        useEffect(() => {
            if (dataStore?.embeddingConfig) {
                setEmbeddingFields(
                    dataStore.embeddingConfig.embeddingFields
                        ? new Set(dataStore.embeddingConfig.embeddingFields)
                        : new Set(),
                );
                setMetadataFields(
                    dataStore.embeddingConfig.metadataFields
                        ? new Set(dataStore.embeddingConfig.metadataFields)
                        : new Set(),
                );
            }
        }, [dataStore?.embeddingConfig]);

        const allFields = useMemo(() => {
            const schemaProps = fields.data?.schema?.properties as Record<string, unknown> | undefined;

            if (!schemaProps) return [];

            return flattenSchema(schemaProps);
        }, [fields.data]);

        const currentSelected = step === 1 ? embeddingFields : metadataFields;
        const currentSetter = step === 1 ? setEmbeddingFields : setMetadataFields;

        const filteredFields = useMemo(() => {
            if (!search.trim()) return allFields;
            const lower = search.toLowerCase();

            return allFields.filter(
                (f) => f.path.toLowerCase().includes(lower) || f.name.toLowerCase().includes(lower),
            );
        }, [allFields, search]);

        const isAllSelected = filteredFields.length > 0 && filteredFields.every((f) => currentSelected.has(f.path));
        const isSomeSelected = !isAllSelected && filteredFields.some((f) => currentSelected.has(f.path));

        const handleToggleAll = (_: unknown, checked: boolean) => {
            currentSetter((prev) => {
                const next = new Set(prev);

                filteredFields.forEach((f) => (checked ? next.add(f.path) : next.delete(f.path)));

                return next;
            });
        };

        const handleToggleField = (path: string, checked: boolean) => {
            currentSetter((prev) => {
                const next = new Set(prev);

                if (checked) next.add(path);
                else next.delete(path);

                return next;
            });
        };

        const submitCronConfig = async (cron: string | null) => {
            if (!dataStore?._id) return;

            try {
                await saveCronMutation.mutateAsync({
                    id: dataStore._id,
                    data: { cron },
                });
            } catch (error) {
                console.error(error);
            }
        };

        const submitEmbeddingConfig = async (
            payload: { embeddingFields: string[]; metadataFields: string[]; cron?: string },
            options?: { onError?: () => void; extraCommonData?: Record<string, unknown> },
        ): Promise<boolean> => {
            if (!dataStore?._id || !wizardData) return false;

            setFormError('');
            try {
                const result = await saveEmbeddingMutation.mutateAsync({
                    id: dataStore._id,
                    data: payload,
                });

                onPageComplete?.(result, { currentPage, method: 'PUT' });
                handleCommonDataChange?.({
                    ...wizardData,
                    ...options?.extraCommonData,
                    dataStore: { ...dataStore, ...result },
                    completedPages: [...(wizardData.completedPages ?? []), currentPage],
                });

                if (wizardData?.dontSkipCron === undefined) {
                    wizardData?.requestCronChoice?.();
                    setCanGoNext(true);

                    return false;
                }
                if (wizardData?.dontSkipCron === false) {
                    submitCronConfig(null);
                }

                setCanGoNext(true);

                return true;
            } catch (error: unknown) {
                console.error(error);

                const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
                const message = axiosError.response?.data?.message || 'Something went wrong. Please try again.';

                setFormError(
                    axiosError.response?.status === 500 ? 'Internal server error, Please try again.' : message,
                );
                options?.onError?.();

                return false;
            }
        };

        const submitStep = useCallback(async (): Promise<boolean> => {
            if (fields.loading || fields.error) return false;
            if (step === 1 && embeddingFields.size === 0) {
                showErrorToast('Please select at least one embedding field.');

                return false;
            }
            if (step === 1) {
                setSearch('');
                setStep(2);

                return false;
            }
            if (step === 2 && metadataFields.size === 0) {
                showErrorToast('Please select at least one metadata field.');

                return false;
            }

            if (step === 2 && isAlreadyAdded && dataStore?.embeddingConfig) {
                const cfg = dataStore.embeddingConfig;
                const savedEmb = new Set(cfg.embeddingFields ?? []);
                const savedMeta = new Set(cfg.metadataFields ?? []);

                const noFieldChanges =
                    setsEqualString(embeddingFields, savedEmb) && setsEqualString(metadataFields, savedMeta);

                if (noFieldChanges && wizardData?.dontSkipCron === undefined) {
                    wizardData?.requestCronChoice?.();

                    return false;
                }

                if (noFieldChanges) {
                    return true;
                }
            }

            return submitEmbeddingConfig({
                embeddingFields: Array.from(embeddingFields),
                metadataFields: Array.from(metadataFields),
            });
        }, [
            embeddingFields,
            fields.error,
            fields.loading,
            metadataFields,
            step,
            submitEmbeddingConfig,
            isAlreadyAdded,
            dataStore?.embeddingConfig,
            wizardData?.dontSkipCron,
            wizardData?.requestCronChoice,
        ]);

        useImperativeHandle(
            ref,
            () => ({
                submitStep,
                handleFooterPrev: () => {
                    if (stepRef.current !== 2) return false;
                    setSearch('');
                    setStep(1);

                    return true;
                },
            }),
            [submitStep],
        );

        const renderFieldSelector = () => (
            <>
                <div className="flex items-center gap-3">
                    <div className="fields-search-wrapper flex-1">
                        <SearchIcon className="fields-search-icon size-4" />
                        <Input
                            className="fields-search-input"
                            placeholder="Search fields..."
                            value={search}
                            onChange={(e) => setSearch(e.target.value)}
                        />
                    </div>
                    <Checkbox
                        checked={isAllSelected}
                        indeterminate={isSomeSelected}
                        label={isAllSelected ? 'Deselect all' : 'Select all'}
                        onChange={handleToggleAll}
                    />
                </div>
                <div className="wizard-form-step-content-container scrollbar-controller scrollbar-vertical scrollbar-horizontal fields-list flex flex-col gap-4 pb-4">
                    {filteredFields.length === 0 && (
                        <div className="flex items-center justify-center p-8">
                            <span className="text-sm text-muted-foreground">No fields found.</span>
                        </div>
                    )}
                    {filteredFields.map((field) => (
                        <div
                            key={field.path}
                            role="button"
                            tabIndex={0}
                            className={cn('field-row flex items-center gap-2', field.depth > 0 && 'field-row-nested')}
                            style={{ paddingLeft: `${field.depth * 20 + 12}px` }}
                            onClick={() => handleToggleField(field.path, !currentSelected.has(field.path))}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleToggleField(field.path, !currentSelected.has(field.path));
                                }
                            }}
                        >
                            <Checkbox
                                checked={currentSelected.has(field.path)}
                                onChange={(_, checked) => handleToggleField(field.path, checked)}
                            />
                            <span className="field-name">{field.name}</span>
                            {field.hasChildren && (
                                <span className="text-xs text-muted-foreground">{`(${field.type})`}</span>
                            )}
                            <div className="ml-auto flex items-center gap-1">
                                {field.nullable && <span className="field-nullable-badge">nullable</span>}
                                <span className={getFieldsTypeBadgeClass(field.type)}>
                                    {field.format ? `${field.type} · ${field.format}` : field.type}
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </>
        );

        const sampleData = fields.data?.sample ?? [];

        if (fields.loading) {
            return (
                <div className="flex h-[50svh] items-center justify-center px-4 py-6">
                    <div className="flex flex-col items-center justify-center gap-6">
                        <SpinnerBlade className="scale-150" />
                        <span className="text-sm">Fetching Fields...</span>
                    </div>
                </div>
            );
        }

        if (fields.error) {
            return (
                <div className="flex h-[50svh] items-center justify-center px-4 py-6">
                    <div className="flex flex-col items-center justify-center gap-6">
                        <h2 className="text-center font-medium">Error Fetching Fields</h2>
                    </div>
                </div>
            );
        }

        const fieldsWizard = (
            <div className="data-stores-fields-wizard flex min-w-0 flex-1 flex-col gap-4">
                {!jsonPanelExpanded && (
                    <Button
                        variant="outline"
                        size="xs"
                        className="self-start"
                        onClick={() => setJsonPanelExpanded(true)}
                    >
                        <PanelTopIcon className="size-4" />
                        Show Samples
                    </Button>
                )}
                <div className="wizard-steps flex items-center">
                    {FIELDS_STEPS.map(({ step: s, label }, idx) => (
                        <Fragment key={s}>
                            <div
                                className={cn(
                                    'wizard-step-item flex items-center gap-2',
                                    s === step && 'active',
                                    s < step && 'completed',
                                )}
                            >
                                <div className="wizard-step-circle">{s < step ? '✓' : s}</div>
                                <span className="wizard-step-label">{label}</span>
                            </div>
                            {idx < FIELDS_STEPS.length - 1 && <div className="wizard-step-line mx-6 w-10" />}
                        </Fragment>
                    ))}
                </div>
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{FIELDS_STEPS[step - 1].label}</span>
                    {currentSelected.size > 0 && (
                        <span className="fields-count-badge">
                            {currentSelected.size}
                            {' of '}
                            {allFields.length}
                            {' selected'}
                        </span>
                    )}
                </div>
                {renderFieldSelector()}
            </div>
        );

        return (
            <div className="tab-content data-stores-tab flex flex-1 flex-col">
                {formError && (
                    <div className="add-data-store-error py-2">
                        <span className="text-sm font-medium text-destructive">{formError}</span>
                    </div>
                )}
                {jsonPanelExpanded ? (
                    <ResizablePanelGroup className="data-stores-split-pane" orientation="vertical">
                        <ResizablePanel className="flex min-w-0 flex-col" minSize="25%" defaultSize="35%" maxSize="50%">
                            <div className="fields-sample-viewer-header flex items-center justify-between gap-2">
                                <span className="text-sm font-medium">Samples</span>
                                <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => setJsonPanelExpanded(false)}
                                    title="Hide sample JSON"
                                >
                                    <PanelBottomIcon className="size-4" />
                                </Button>
                            </div>
                            <div className="fields-sample-viewer min-h-0 flex-1">
                                <JSONEditor content={{ json: sampleData }} readOnly mode="text" />
                            </div>
                        </ResizablePanel>
                        <ResizableHandle withHandle />
                        <ResizablePanel className="flex min-w-0 flex-col" minSize="30%" defaultSize="65%">
                            {fieldsWizard}
                        </ResizablePanel>
                    </ResizablePanelGroup>
                ) : (
                    fieldsWizard
                )}
            </div>
        );
    },
);

ConfigureFieldsStep.displayName = 'ConfigureFieldsStep';
