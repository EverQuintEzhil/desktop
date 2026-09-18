import { ChevronLeftIcon, PanelLeftIcon, PanelLeftCloseIcon, SearchIcon } from 'lucide-react';
import { Fragment, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

import JSONEditor from '@/components/json-editor';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from '@/components/ui/resizable';
import SpinnerBlade from '@/components/ui/spinner';
import { useWizardFieldsQuery, useWizardSaveEmbeddingConfigMutation } from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';
import type { DataStoreType } from '@/types/admin';
import { showErrorToast, showSuccessToast } from '@/utils';

import '../../data-stores-detail.scss';

import { flattenSchema, getFieldsTypeBadgeClass, STEPS } from './schema-helpers';
import './data-stores-fields.scss';

interface Props {
    dataStore: DataStoreType;
    canUserEdit: boolean;
    onSubmit: (value: DataStoreType) => void;
}

const DataStoresFields = (props: Props) => {
    const { dataStore, onSubmit } = props;
    const saveEmbeddingMutation = useWizardSaveEmbeddingConfigMutation();
    const wizardFieldsQuery = useWizardFieldsQuery(dataStore._id);
    const fields = {
        data: wizardFieldsQuery.data ?? null,
        loading: wizardFieldsQuery.isPending,
        error: wizardFieldsQuery.isError,
    };
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [jsonPanelExpanded, setJsonPanelExpanded] = useState(false);
    const [step, setStep] = useState<1 | 2>(1);
    const [embeddingFields, setEmbeddingFields] = useState<Set<string>>(
        dataStore.embeddingConfig?.embeddingFields ? new Set(dataStore.embeddingConfig.embeddingFields) : new Set(),
    );
    const [metadataFields, setMetadataFields] = useState<Set<string>>(
        dataStore.embeddingConfig?.metadataFields ? new Set(dataStore.embeddingConfig.metadataFields) : new Set(),
    );
    const [search, setSearch] = useState('');
    const navigate = useNavigate();

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

        return allFields.filter((f) => f.path.toLowerCase().includes(lower) || f.name.toLowerCase().includes(lower));
    }, [allFields, search]);

    const isAllSelected = filteredFields.length > 0 && filteredFields.every((f) => currentSelected.has(f.path));
    const isSomeSelected = !isAllSelected && filteredFields.some((f) => currentSelected.has(f.path));

    const handleToggleAll = (_: unknown, checked: boolean) => {
        currentSetter((prev) => {
            const next = new Set(prev);

            filteredFields.forEach((f) => {
                if (checked) next.add(f.path);
                else next.delete(f.path);
            });

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

    const goNext = () => {
        setSearch('');
        setStep((s) => (s + 1) as 2);
    };

    const goBack = () => {
        setSearch('');
        setStep((s) => (s - 1) as 1);
    };

    const handleSubmit = async () => {
        setIsSubmitting(true);
        try {
            if (embeddingFields.size === 0) {
                showErrorToast('Please select at least one embedding field.');

                return;
            }
            if (metadataFields.size === 0) {
                showErrorToast('Please select at least one metadata field.');

                return;
            }

            const result = await saveEmbeddingMutation.mutateAsync({
                id: dataStore._id,
                data: {
                    embeddingFields: Array.from(embeddingFields),
                    metadataFields: Array.from(metadataFields),
                },
            });

            showSuccessToast('Settings saved successfully.');
            onSubmit(result);
        } catch (error) {
            console.error(error);
            showErrorToast('Failed to save settings.');
        } finally {
            setIsSubmitting(false);
        }
    };

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

            <div className="fields-list">
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
            <div className="binary-loading-wrapper flex items-center justify-center px-4 py-6">
                <div className="flex flex-col items-center justify-center gap-6">
                    <SpinnerBlade className="scale-150" />
                    <span className="text-sm">Fetching Fields...</span>
                </div>
            </div>
        );
    }
    if (fields.error) {
        return (
            <div className="flex items-center justify-center px-4 py-6">
                <div className="flex flex-col items-center justify-center gap-6">
                    <h2 className="text-center font-medium">Error Fetching Fields</h2>
                </div>
            </div>
        );
    }

    const fieldsWizard = (
        <div className="data-stores-fields-wizard flex min-w-0 flex-1 flex-col gap-4">
            {!jsonPanelExpanded && (
                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon-sm"
                        onClick={() => navigate(`/admin/data-stores/${dataStore._id}/embeddings-index`)}
                    >
                        <ChevronLeftIcon />
                    </Button>
                    <Button
                        variant="outline"
                        size="sm"
                        className="self-start"
                        onClick={() => setJsonPanelExpanded(true)}
                    >
                        <PanelLeftIcon className="size-4" />
                        Show Samples
                    </Button>
                </div>
            )}
            <div className="wizard-steps flex items-center">
                {STEPS.map(({ step: s, label }, idx) => (
                    <Fragment key={s}>
                        <div
                            className={cn(
                                'wizard-step-item flex cursor-pointer items-center gap-2',
                                s === step && 'active',
                            )}
                            onClick={() => setStep(s)}
                        >
                            <div className="wizard-step-circle">{s}</div>
                            <span className="wizard-step-label">{label}</span>
                        </div>
                        {idx < STEPS.length - 1 && <div className="wizard-step-line mx-6 w-10" />}
                    </Fragment>
                ))}
            </div>

            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <span className="text-sm font-medium">{STEPS[step - 1].label}</span>
                    {currentSelected.size > 0 && (
                        <span className="fields-count-badge">
                            {currentSelected.size}
                            {' of '}
                            {allFields.length}
                            {' selected'}
                        </span>
                    )}
                </div>
                <div className="flex items-center gap-2">
                    {step > 1 && (
                        <Button variant="outline" size="sm" onClick={goBack} disabled={isSubmitting}>
                            Back
                        </Button>
                    )}
                    {step < STEPS.length && (
                        <Button size="sm" onClick={goNext}>
                            Next
                        </Button>
                    )}
                    {step === 2 && (
                        <Button size="sm" onClick={handleSubmit} disabled={isSubmitting}>
                            {isSubmitting ? <SpinnerBlade className="scale-75" /> : null}
                            {isSubmitting ? 'Saving...' : 'Save'}
                        </Button>
                    )}
                </div>
            </div>

            {renderFieldSelector()}
        </div>
    );

    return (
        <div className="tab-content data-stores-tab flex h-full flex-col">
            {jsonPanelExpanded ? (
                <ResizablePanelGroup className="data-stores-split-pane" orientation="horizontal">
                    <ResizablePanel className="flex min-w-0 flex-col" minSize="25%" defaultSize="35%" maxSize="60%">
                        <div className="fields-sample-viewer-header flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    onClick={() => navigate(`/admin/data-stores/${dataStore._id}/embeddings-index`)}
                                >
                                    <ChevronLeftIcon />
                                </Button>
                                <span className="text-sm font-medium">Samples</span>
                            </div>
                            <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => setJsonPanelExpanded(false)}
                                title="Hide sample JSON"
                            >
                                <PanelLeftCloseIcon className="size-4" />
                            </Button>
                        </div>
                        <div className="fields-sample-viewer min-h-0 flex-1">
                            <JSONEditor content={{ json: sampleData }} readOnly mode="text" />
                        </div>
                    </ResizablePanel>
                    <ResizableHandle withHandle />
                    <ResizablePanel className="flex min-w-0 flex-col p-2" minSize="30%" defaultSize="65%">
                        {fieldsWizard}
                    </ResizablePanel>
                </ResizablePanelGroup>
            ) : (
                fieldsWizard
            )}
        </div>
    );
};

export default DataStoresFields;
