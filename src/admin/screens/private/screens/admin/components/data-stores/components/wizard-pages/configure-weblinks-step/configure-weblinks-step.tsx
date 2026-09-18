import { PlusIcon } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useState } from 'react';

import type { WizardFormPageHandle, WizardFormPageProps } from '@/admin/components/wizard';
import { Button } from '@/components/ui/button';
import { useWizardSaveConnectionMutation, useWizardSaveWeblinksMutation } from '@/lib/api/admin/data-stores';
import type { DataStoreType } from '@/types/admin';

import WeblinkRowEditor from './weblink-row-editor';
import {
    buildWeblinksAuthPayload,
    createEmptyWeblinkRow,
    parseWeblinksLinks,
    toWeblinkRow,
    toWeblinkSpec,
    validateWeblinkRows,
    type WeblinkFormRow,
} from './weblinks-validation';

type WizardData = {
    dataStore?: DataStoreType;
    completedPages?: number[];
} | null;

export const ConfigureWeblinksStep = forwardRef<WizardFormPageHandle, WizardFormPageProps>(
    ({ currentPage, setCanGoNext, onPageComplete, handleCommonDataChange, commonData }, ref) => {
        const saveWeblinksMutation = useWizardSaveWeblinksMutation();
        const saveConnectionMutation = useWizardSaveConnectionMutation();

        const wizardData = commonData as WizardData;
        const dataStore = wizardData?.dataStore;
        const isAlreadyAdded = wizardData?.completedPages?.includes(currentPage);

        // Seeded once from whatever is already saved on the data store; the wizard step never
        // re-seeds from the server after that so in-progress row edits aren't clobbered by refetches.
        const initialRows = useMemo<WeblinkFormRow[]>(() => {
            const specLinks = parseWeblinksLinks(dataStore?.specification);

            return specLinks.length > 0 ? specLinks.map(toWeblinkRow) : [createEmptyWeblinkRow()];
        }, []);

        const [rows, setRows] = useState<WeblinkFormRow[]>(initialRows);
        const [expandedRowIds, setExpandedRowIds] = useState<Set<string>>(
            () => new Set(initialRows[0] ? [initialRows[0].id] : []),
        );
        const [showErrors, setShowErrors] = useState(false);
        const [formError, setFormError] = useState('');

        useEffect(() => {
            setCanGoNext(true);
        }, [setCanGoNext]);

        const toggleExpanded = (id: string) => {
            setExpandedRowIds((prev) => {
                const next = new Set(prev);

                if (next.has(id)) next.delete(id);
                else next.add(id);

                return next;
            });
        };

        const updateRow = (id: string, patch: Partial<WeblinkFormRow>) => {
            setRows((prev) => prev.map((row) => (row.id === id ? { ...row, ...patch } : row)));
        };

        const addRow = () => {
            const row = createEmptyWeblinkRow();

            setRows((prev) => [...prev, row]);
            setExpandedRowIds((prev) => new Set(prev).add(row.id));
        };

        const removeRow = (id: string) => {
            setRows((prev) => prev.filter((row) => row.id !== id));
        };

        const submitStep = useCallback(async (): Promise<boolean> => {
            setFormError('');

            const validationError = validateWeblinkRows(rows);

            if (validationError) {
                setShowErrors(true);
                setFormError(validationError);

                return false;
            }

            if (!dataStore?._id || !wizardData) return false;

            try {
                const links = rows.map(toWeblinkSpec);
                const result = await saveWeblinksMutation.mutateAsync({ id: dataStore._id, data: { links } });

                const authPayload = buildWeblinksAuthPayload(rows);

                if (authPayload) {
                    await saveConnectionMutation.mutateAsync({ id: dataStore._id, data: authPayload });
                }

                onPageComplete?.(result, { currentPage, method: 'PUT' });
                handleCommonDataChange?.({
                    ...wizardData,
                    dataStore: { ...dataStore, ...result },
                    completedPages: [...(wizardData.completedPages ?? []), currentPage],
                });

                setCanGoNext(true);

                return true;
            } catch (error: unknown) {
                console.error(error);

                const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
                const message = axiosError.response?.data?.message || 'Something went wrong. Please try again.';

                setFormError(
                    axiosError.response?.status === 500 ? 'Internal server error, Please try again.' : message,
                );

                return false;
            }
        }, [
            rows,
            dataStore,
            wizardData,
            saveWeblinksMutation,
            saveConnectionMutation,
            onPageComplete,
            currentPage,
            handleCommonDataChange,
            setCanGoNext,
        ]);

        useImperativeHandle(ref, () => ({ submitStep }), [submitStep]);

        useEffect(() => {
            if (isAlreadyAdded) {
                setCanGoNext(true);
            }
        }, [currentPage, isAlreadyAdded, setCanGoNext]);

        return (
            <div className="flex min-h-0 flex-col gap-4">
                <div className="flex shrink-0 flex-col gap-1">
                    <span className="font-medium">Links</span>
                    <span className="text-sm text-muted-foreground">
                        Add the pages or sites this data store should crawl or scrape. Crawl links index an entire site;
                        scrape links index exactly one page.
                    </span>
                </div>

                <div className="flex min-h-0 flex-col overflow-hidden rounded-md border border-border bg-(--bg-surface)">
                    {rows.length === 0 ? (
                        <span className="block px-3 py-2 text-xs text-text-secondary">No links added yet.</span>
                    ) : (
                        <div className="scrollbar-controller scrollbar-vertical flex max-h-[max(180px,calc(96svh-450px))] flex-col">
                            {rows.map((row) => (
                                <WeblinkRowEditor
                                    key={row.id}
                                    row={row}
                                    isExpanded={expandedRowIds.has(row.id)}
                                    showErrors={showErrors}
                                    onToggleExpanded={() => toggleExpanded(row.id)}
                                    onChange={(patch) => updateRow(row.id, patch)}
                                    onRemove={() => removeRow(row.id)}
                                />
                            ))}
                        </div>
                    )}
                    <div className="flex shrink-0 items-center justify-end gap-3 border-t border-border px-3 py-2">
                        <Button type="button" variant="outline" size="sm" onClick={addRow}>
                            <PlusIcon className="mr-1" />
                            Add link
                        </Button>
                    </div>
                </div>

                {formError && (
                    <div className="add-data-store-error shrink-0 py-2">
                        <span className="text-center text-sm font-medium text-destructive">{formError}</span>
                    </div>
                )}
            </div>
        );
    },
);

ConfigureWeblinksStep.displayName = 'ConfigureWeblinksStep';
