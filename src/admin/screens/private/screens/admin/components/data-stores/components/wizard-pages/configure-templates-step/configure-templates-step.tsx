import { PencilIcon, SearchIcon } from 'lucide-react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';

import type { WizardFormPageHandle, WizardFormPageProps } from '@/admin/components/wizard';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import SpinnerBlade from '@/components/ui/spinner';
import { useCreateDatastoreToolMutation, useWizardTemplatesQuery } from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';
import type { DataStoreType } from '@/types/admin';
import { showErrorToast } from '@/utils';

import '../../data-stores-detail/components/data-stores-templates/data-stores-templates.scss';

import { TEMPLATE_KEY_COLORS, type Template } from './types';

export const ConfigureTemplatesStep = forwardRef<WizardFormPageHandle, WizardFormPageProps>(
    ({ currentPage, setCanGoNext, onPageComplete, handleCommonDataChange, commonData }, ref) => {
        const createToolMutation = useCreateDatastoreToolMutation();
        const wizardData = commonData as { dataStore?: DataStoreType; completedPages?: number[] } | null;
        const dataStore = wizardData?.dataStore;
        const isAlreadyAdded = wizardData?.completedPages?.includes(currentPage);

        const tools = dataStore?.tools;
        const templatesQuery = useWizardTemplatesQuery(dataStore?._id);
        const [templates, setTemplates] = useState<Template[]>([]);

        useEffect(() => {
            if (templatesQuery.data) {
                setTemplates(templatesQuery.data as Template[]);
            }
        }, [templatesQuery.data]);
        const [selected, setSelected] = useState<Set<string>>(
            tools ? new Set(tools.map((tool) => tool.refName)) : new Set(),
        );
        const [search, setSearch] = useState('');
        const [editingRefName, setEditingRefName] = useState<null | string>(null);
        const [editDraft, setEditDraft] = useState<null | Pick<Template, 'name' | 'refName' | 'description'>>(null);

        const baselineSubmitPayloadRef = useRef<string | null>(null);
        const baselineHydratedRef = useRef(false);

        const buildTemplateSubmitPayload = useCallback(() => {
            if (!dataStore?._id) return [];

            return Array.from(selected)
                .sort()
                .map((refName) => {
                    const template = templates.find((t) => t.refName === refName);

                    return {
                        name: template?.name,
                        description: template?.description,
                        refName: template?.refName,
                        code: {
                            lang: 'lua',
                            code: template?.code,
                            version: '1',
                        },
                        parameters: template?.parameters,
                        dataStoreIds: [dataStore._id],
                    };
                });
        }, [dataStore?._id, selected, templates]);

        useEffect(() => {
            baselineHydratedRef.current = false;
            baselineSubmitPayloadRef.current = null;
        }, [dataStore?._id]);

        useEffect(() => {
            if (
                !isAlreadyAdded ||
                templatesQuery.isPending ||
                templatesQuery.isError ||
                templates.length === 0 ||
                !dataStore?._id ||
                baselineHydratedRef.current
            ) {
                return;
            }
            baselineSubmitPayloadRef.current = JSON.stringify(buildTemplateSubmitPayload());
            baselineHydratedRef.current = true;
        }, [
            buildTemplateSubmitPayload,
            dataStore?._id,
            isAlreadyAdded,
            templates,
            templatesQuery.isError,
            templatesQuery.isPending,
        ]);

        const filtered = useMemo(() => {
            if (!search.trim()) return templates;

            const lower = search.toLowerCase();

            return templates.filter(
                (t) => t.name.toLowerCase().includes(lower) || t.description.toLowerCase().includes(lower),
            );
        }, [templates, search]);

        const isAllSelected = filtered.length > 0 && filtered.every((t) => selected.has(t.refName));
        const isSomeSelected = !isAllSelected && filtered.some((t) => selected.has(t.refName));

        const handleToggleAll = (_: unknown, checked: boolean) => {
            setSelected((prev) => {
                const next = new Set(prev);

                filtered.forEach((t) => {
                    if (checked) next.add(t.refName);
                    else next.delete(t.refName);
                });

                return next;
            });
        };

        const handleToggle = (refName: string, checked: boolean) => {
            setSelected((prev) => {
                const next = new Set(prev);

                if (checked) next.add(refName);
                else next.delete(refName);

                return next;
            });
        };

        const handleEditStart = (template: Template) => {
            setEditingRefName(template.refName);
            setEditDraft({
                name: template.name,
                refName: template.refName,
                description: template.description,
            });
        };

        const handleDraftFieldChange = (field: 'name' | 'refName' | 'description', value: string) => {
            setEditDraft((prev) => {
                if (!prev) return prev;

                return {
                    ...prev,
                    [field]: value,
                };
            });
        };

        const handleEditSave = (originalRefName: string) => {
            if (!editDraft) return;

            setTemplates((prev) =>
                prev.map((template) => {
                    if (template.refName !== originalRefName) return template;

                    return {
                        ...template,
                        name: editDraft.name,
                        refName: editDraft.refName,
                        description: editDraft.description,
                    };
                }),
            );

            setSelected((prev) => {
                if (!prev.has(originalRefName)) return prev;

                const next = new Set(prev);

                next.delete(originalRefName);
                if (editDraft.refName.trim()) next.add(editDraft.refName);

                return next;
            });

            setEditingRefName(null);
            setEditDraft(null);
        };

        const submitStep = useCallback(async (): Promise<boolean> => {
            if (!dataStore?._id || !wizardData) return false;
            if (templatesQuery.isPending || templatesQuery.isError) return false;

            if (editingRefName !== null) {
                showErrorToast('Finish or cancel editing a template before continuing.');

                return false;
            }

            const nextPayloadJson = JSON.stringify(buildTemplateSubmitPayload());

            if (
                isAlreadyAdded &&
                baselineSubmitPayloadRef.current !== null &&
                nextPayloadJson === baselineSubmitPayloadRef.current
            ) {
                onPageComplete?.(dataStore, { currentPage, method: 'PUT' });

                return true;
            }

            const finalTemplateTools = buildTemplateSubmitPayload();

            if (selected.size === 0) {
                const updatedDataStore = { ...dataStore, tools: [] };

                onPageComplete?.(updatedDataStore, { currentPage, method: 'PUT' });
                handleCommonDataChange?.({
                    ...wizardData,
                    dataStore: updatedDataStore,
                    completedPages: [...(wizardData.completedPages ?? []), currentPage],
                });
                setCanGoNext(true);
                baselineSubmitPayloadRef.current = JSON.stringify(finalTemplateTools);
                baselineHydratedRef.current = true;

                return true;
            }

            try {
                const result = await createToolMutation.mutateAsync(finalTemplateTools);

                onPageComplete?.(result, { currentPage, method: 'PUT' });
                handleCommonDataChange?.({
                    ...wizardData,
                    dataStore: { ...dataStore, ...result },
                    completedPages: [...(wizardData.completedPages ?? []), currentPage],
                });
                setCanGoNext(true);
                baselineSubmitPayloadRef.current = JSON.stringify(finalTemplateTools);
                baselineHydratedRef.current = true;

                return true;
            } catch (error: unknown) {
                console.error(error);
                const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
                const message = axiosError.response?.data?.message || 'Something went wrong. Please try again.';

                showErrorToast('Failed to save templates: ' + message);

                return false;
            }
        }, [
            buildTemplateSubmitPayload,
            createToolMutation,
            currentPage,
            dataStore,
            editingRefName,
            handleCommonDataChange,
            isAlreadyAdded,
            onPageComplete,
            selected,
            setCanGoNext,
            templatesQuery.isError,
            templatesQuery.isPending,
            wizardData,
        ]);

        useImperativeHandle(ref, () => ({ submitStep }), [submitStep]);

        if (templatesQuery.isPending) {
            return (
                <div className="flex h-[50svh] items-center justify-center px-4 py-6">
                    <div className="flex flex-col items-center justify-center gap-6">
                        <SpinnerBlade className="scale-150" />
                        <span className="text-sm">Fetching Templates...</span>
                    </div>
                </div>
            );
        }
        if (templatesQuery.isError) {
            return (
                <div className="flex h-[50svh] items-center justify-center px-4 py-6">
                    <div className="flex flex-col items-center justify-center gap-6">
                        <h2 className="text-center font-medium">Error Fetching Templates</h2>
                    </div>
                </div>
            );
        }

        return (
            <div className="template-selection tab-content data-stores-tab flex flex-1 flex-col gap-4">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">Templates</span>
                    {selected.size > 0 && (
                        <span className="template-count-badge">
                            {selected.size}
                            {' of '}
                            {templates.length}
                            {' selected'}
                        </span>
                    )}
                </div>

                <div className="flex items-center gap-3">
                    <div className="template-search-wrapper flex-1">
                        <SearchIcon className="template-search-icon size-4" />
                        <Input
                            className="template-search-input"
                            placeholder="Search templates..."
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

                <div className="template-list scrollbar-controller scrollbar-vertical scrollbar-horizontal">
                    {filtered.length === 0 && (
                        <div className="flex items-center justify-center p-8">
                            <span className="text-sm text-muted-foreground">No templates found.</span>
                        </div>
                    )}
                    {filtered.map((template) => (
                        <div
                            key={template.refName}
                            role="button"
                            tabIndex={0}
                            className={cn(
                                'template-row flex items-center gap-3',
                                selected.has(template.refName) && 'selected',
                            )}
                            onClick={() => handleToggle(template.refName, !selected.has(template.refName))}
                            onKeyDown={(e) => {
                                const target = e.target as HTMLElement;

                                if (target.closest('input, textarea, [contenteditable="true"]')) {
                                    return;
                                }
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    handleToggle(template.refName, !selected.has(template.refName));
                                }
                            }}
                        >
                            <Checkbox
                                checked={selected.has(template.refName)}
                                className="mt-1"
                                onChange={(_, checked) => handleToggle(template.refName, checked)}
                            />
                            {editingRefName === template.refName && editDraft ? (
                                <div className="flex min-w-0 flex-1 flex-col gap-2">
                                    <Input
                                        value={editDraft.name}
                                        className="template-name"
                                        placeholder="Template name"
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleDraftFieldChange('name', e.target.value)}
                                    />
                                    <Input
                                        value={editDraft.refName}
                                        className="template-ref-name"
                                        placeholder="Reference name"
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleDraftFieldChange('refName', e.target.value)}
                                    />
                                    <Input
                                        value={editDraft.description}
                                        className="template-description"
                                        placeholder="Description"
                                        onClick={(e) => e.stopPropagation()}
                                        onChange={(e) => handleDraftFieldChange('description', e.target.value)}
                                    />
                                </div>
                            ) : (
                                <div className="flex min-w-0 flex-1 flex-col">
                                    <span className="template-name">{template.name}</span>
                                    <span className="template-ref-name">{template.refName}</span>
                                    <span className="template-description">{template.description}</span>
                                </div>
                            )}
                            <div className="flex items-center justify-center gap-2">
                                {editingRefName !== template.refName && (
                                    <span
                                        className={cn(
                                            'template-key-badge text-sm',
                                            TEMPLATE_KEY_COLORS[template.templateKey] ?? 'template-key-other',
                                        )}
                                    >
                                        {template.templateKey}
                                    </span>
                                )}
                                {editingRefName === template.refName ? (
                                    <Button
                                        size="sm"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditSave(template.refName);
                                        }}
                                    >
                                        Save
                                    </Button>
                                ) : (
                                    <Button
                                        size="icon-sm"
                                        variant="ghost"
                                        onClick={(e) => {
                                            e.stopPropagation();
                                            handleEditStart(template);
                                        }}
                                    >
                                        <PencilIcon />
                                    </Button>
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        );
    },
);

ConfigureTemplatesStep.displayName = 'ConfigureTemplatesStep';
