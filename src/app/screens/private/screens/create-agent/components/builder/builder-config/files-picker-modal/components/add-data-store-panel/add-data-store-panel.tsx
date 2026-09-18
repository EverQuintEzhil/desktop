import { useStore } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { ArrowLeftIcon, PlusIcon, XIcon } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import connectionFields from '@/admin/screens/private/screens/admin/components/data-stores/components/connectionFields.json';
import {
    type ConnectionProviderOption,
    connectionBuildNestedInitialValues,
    connectionCoerceNestedValues,
    connectionDeriveSslFromUrl,
    connectionFlattenToLeaves,
    connectionGetNestedValue,
    connectionGetValueType,
    connectionUrlPathForSslDerivedFromUrl,
} from '@/admin/screens/private/screens/admin/components/data-stores/components/wizard-pages/configure-connection-step/connection-utils';
import {
    buildWeblinksAuthPayload,
    createEmptyWeblinkRow,
    toWeblinkSpec,
    validateWeblinkRows,
    type WeblinkFormRow,
} from '@/admin/screens/private/screens/admin/components/data-stores/components/wizard-pages/configure-weblinks-step/weblinks-validation';
import { nameToRefName, pickerFormWrapCls } from '@/app/components/picker/picker-shared';
import JSONEditor from '@/components/json-editor';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { SelectSuggestionItem } from '@/components/ui/select';
import Select from '@/components/ui/select';
import TextAreaForm from '@/components/ui/textarea-form';
import {
    useCreateDataStoreMutation,
    useWizardSaveConnectionMutation,
    type DataStoreProviderFilter,
} from '@/lib/api/admin/data-stores';
import { cn } from '@/lib/utils';
import type { ProviderType } from '@/types/admin';
import { showErrorToast, showSuccessToast, parseJsonIfValid } from '@/utils';

import { CATEGORY_ADD_LABELS, dsBtnCls } from '../../constants';
import type { DataStoreItem } from '../../types';

import ConnectionFieldsSection from './components/connection-fields-section';
import WeblinksFieldsSection from './components/weblinks-fields-section';
import {
    CATEGORY_CREATE_BUTTON_LABELS,
    CATEGORY_CREATE_TITLES,
    CATEGORY_PROVIDER_OPTIONS,
    PROVIDER_LABELS,
} from './constants';
import { useDataStoreForm } from './hooks';

export interface AddDataStorePanelProps {
    category: DataStoreProviderFilter;
    onBack: () => void;
    onClose: () => void;
    onSuccess: (dataStore: DataStoreItem) => void;
}

const AddDataStorePanel = ({ category, onBack, onClose, onSuccess }: AddDataStorePanelProps) => {
    const queryClient = useQueryClient();
    const createMutation = useCreateDataStoreMutation();
    const saveConnectionMutation = useWizardSaveConnectionMutation();
    const isRefNameEditedByUserRef = useRef(false);
    const [formError, setFormError] = useState('');
    const [activeOptionIndex, setActiveOptionIndex] = useState(0);

    // Weblinks stores have no `connectionFields` entry — their links ride along in the create
    // payload as `specification.links`. Seeded with one expanded row since at least one is required.
    const initialWeblinkRows = useMemo<WeblinkFormRow[]>(() => [createEmptyWeblinkRow()], []);
    const [weblinkRows, setWeblinkRows] = useState<WeblinkFormRow[]>(initialWeblinkRows);
    const [expandedWeblinkRowIds, setExpandedWeblinkRowIds] = useState<Set<string>>(
        () => new Set(initialWeblinkRows.map((row) => row.id)),
    );
    const [showWeblinkErrors, setShowWeblinkErrors] = useState(false);

    const providerChoices = CATEGORY_PROVIDER_OPTIONS[category];
    const defaultProviderOption = providerChoices[0];
    const hasProviderChoice = providerChoices.length > 1;

    const form = useDataStoreForm({
        defaultValues: {
            provider: {
                value: defaultProviderOption.value,
                label: defaultProviderOption.label,
            } as SelectSuggestionItem<ProviderType>,
            name: '',
            description: '',
            refName: '',
            specification: { text: '' } as Content,
            connection: {} as Record<string, unknown>,
        },
        onSubmit: async ({ value }) => {
            setFormError('');

            if (!value.name.trim()) {
                showErrorToast('Data store name is required.');

                return;
            }

            if (!value.refName.trim()) {
                showErrorToast('Ref name is required.');

                return;
            }

            const providerValue = value.provider.value as ProviderType;
            const isFiles = providerValue === 'files';
            const isCustom = providerValue === 'custom';
            const isWeblinks = providerValue === 'weblinks';

            // A weblinks store needs at least one valid link — `validateWeblinkRows` rejects an
            // empty list as well as any malformed row.
            if (isWeblinks) {
                const linksError = validateWeblinkRows(weblinkRows);

                if (linksError) {
                    setShowWeblinkErrors(true);
                    setFormError(linksError);

                    return;
                }
            }

            let createdId: string | undefined;

            try {
                const createObj: Record<string, unknown> = isFiles
                    ? {
                          provider: providerValue,
                          name: value.name.trim(),
                          refName: value.refName.trim(),
                      }
                    : {
                          provider: providerValue,
                          name: value.name.trim(),
                          description: value.description.trim(),
                          refName: value.refName.trim(),
                      };

                if (!isFiles) {
                    if (isWeblinks) {
                        createObj.specification = { links: weblinkRows.map(toWeblinkSpec) };
                    } else if (isCustom) {
                        const parsedSpec = parseJsonIfValid(value.specification);

                        if (parsedSpec && Object.keys(parsedSpec).length > 0) {
                            createObj.specification = parsedSpec;
                        }
                    } else {
                        const providerOpts: ConnectionProviderOption[] =
                            (connectionFields as unknown as Record<string, ConnectionProviderOption[]>)[
                                providerValue
                            ] ?? [];
                        const activeFields = providerOpts[activeOptionIndex]?.config ?? {};
                        const connectionData = connectionCoerceNestedValues(value.connection, activeFields);
                        const hasConnectionValues = Object.values(connectionData).some(
                            (v) => v !== null && v !== '' && v !== undefined,
                        );

                        if (hasConnectionValues) {
                            createObj.connection = connectionData;
                        }
                    }
                }

                const response = await createMutation.mutateAsync(createObj);

                createdId = response?._id;

                // The links themselves go out with the create payload; only the per-link
                // credentials need a follow-up call, since `specification` is non-secret.
                if (isWeblinks && createdId) {
                    const authPayload = buildWeblinksAuthPayload(weblinkRows);

                    if (authPayload) {
                        await saveConnectionMutation.mutateAsync({ id: createdId, data: authPayload });
                    }
                }

                await queryClient.invalidateQueries({ queryKey: ['create-agent', 'datastores'] });
                showSuccessToast(`${CATEGORY_ADD_LABELS[category]} created successfully.`);
                if (response?._id) {
                    onSuccess({
                        _id: response._id,
                        name: response.name,
                        description: !isFiles ? value.description.trim() : undefined,
                        provider: providerValue,
                    });
                }
            } catch (error: unknown) {
                const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
                const fallback = createdId
                    ? 'The store was created, but saving its link credentials failed. Open it from the list to finish setup.'
                    : 'Failed to create data store.';
                const message = axiosError.response?.data?.message || fallback;

                setFormError(
                    axiosError.response?.status === 500 ? 'Internal server error, Please try again.' : message,
                );

                if (createdId) {
                    await queryClient.invalidateQueries({ queryKey: ['create-agent', 'datastores'] });
                }
            }
        },
    });

    const formValues = useStore(form.store, (state) => state.values);
    const selectedProvider = formValues.provider?.value as ProviderType | undefined;
    const isFilesProvider = selectedProvider === 'files';
    const isCustomProvider = selectedProvider === 'custom';
    const isWeblinksProvider = selectedProvider === 'weblinks';
    const showConnectionFields = !!selectedProvider && !isFilesProvider && !isCustomProvider && !isWeblinksProvider;

    const providerOptions: ConnectionProviderOption[] = selectedProvider
        ? ((connectionFields as unknown as Record<string, ConnectionProviderOption[]>)[selectedProvider] ?? [])
        : [];

    useEffect(() => {
        if (formError) {
            setFormError('');
        }
    }, [formValues]);

    useEffect(() => {
        setActiveOptionIndex(0);
        form.setFieldValue('connection', connectionBuildNestedInitialValues(providerOptions[0]?.config ?? {}) as never);
    }, [selectedProvider]);

    useEffect(() => {
        form.setFieldValue(
            'connection',
            connectionBuildNestedInitialValues(providerOptions[activeOptionIndex]?.config ?? {}) as never,
        );
    }, [activeOptionIndex]);

    const connectionValues = formValues.connection as Record<string, unknown>;

    useEffect(() => {
        if (!showConnectionFields) return;

        const activeFields = providerOptions[activeOptionIndex]?.config ?? {};
        const syncLeaves = connectionFlattenToLeaves(activeFields);
        const sslLeaf = syncLeaves.find(
            (l) => l.derivedFromUrl === true && connectionGetValueType(l.value) === 'boolean',
        );

        if (!sslLeaf) return;

        const urlPath = connectionUrlPathForSslDerivedFromUrl(sslLeaf.path);
        const urlVal = connectionGetNestedValue(connectionValues, urlPath);
        const next = String(connectionDeriveSslFromUrl(urlVal));
        const current = String(connectionGetNestedValue(connectionValues, sslLeaf.path) ?? '');

        if (current !== next) {
            form.setFieldValue(`connection.${sslLeaf.path}` as never, next as never);
        }
    }, [showConnectionFields, activeOptionIndex, connectionValues, selectedProvider]);

    const renderSpecificationField = () => {
        if (!isCustomProvider) return null;

        return (
            <form.Field name="specification">
                {(field) => (
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-sm font-medium text-text-secondary">
                            Specification <span className="text-destructive">*</span>
                        </Label>
                        <JSONEditor
                            content={field.state.value}
                            onBlur={field.handleBlur}
                            containerClassName="max-h-[200px] flex flex-col overflow-hidden scrollbar-controller scrollbar-vertical"
                            onChange={(content: Content) => {
                                field.handleChange(content);
                            }}
                        />
                    </div>
                )}
            </form.Field>
        );
    };

    const isPending = createMutation.isPending || saveConnectionMutation.isPending;

    return (
        <div className="flex h-full flex-col">
            <div className="modal-agent-header sticky top-0 z-2 flex h-[80px] items-center gap-3 border-b border-border bg-card px-4 py-3">
                <Button
                    variant="ghost"
                    size="icon"
                    className={cn('sm:hidden', dsBtnCls)}
                    aria-label="Back"
                    onClick={onBack}
                >
                    <ArrowLeftIcon size={17} aria-hidden="true" />
                </Button>
                <div
                    className={cn(
                        'flex size-14 shrink-0 items-center justify-center rounded-[18px] bg-primary text-primary-foreground',
                    )}
                >
                    <PlusIcon size={22} aria-hidden="true" />
                </div>
                <div className="flex min-w-0 flex-1 flex-col">
                    <h3 className="truncate text-lg font-medium tracking-[-0.03em] text-(--text-primary)">
                        {formValues.name.trim() || CATEGORY_CREATE_TITLES[category]}
                    </h3>
                    <span className="truncate text-sm text-text-secondary">
                        {formValues.provider?.label || 'Select your provider'}
                    </span>
                </div>
                <Button variant="ghost" size="icon" className={dsBtnCls} aria-label="Close" onClick={onClose}>
                    <XIcon size={17} aria-hidden="true" />
                </Button>
            </div>

            <div className="modal-agent-content scrollbar-controller scrollbar-vertical flex-1 px-4 py-6">
                <form
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void form.handleSubmit();
                    }}
                    className={cn('flex flex-col gap-5', pickerFormWrapCls)}
                >
                    {hasProviderChoice && (
                        <form.Field
                            name="provider"
                            validators={{
                                onChange: ({ value }) => (!value ? 'Provider is required' : undefined),
                            }}
                        >
                            {(field) => (
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-sm font-medium text-text-secondary">
                                        Provider <span className="text-destructive">*</span>
                                    </Label>
                                    <Select<ProviderType>
                                        variant="ghost"
                                        placeholder="Select"
                                        options={providerChoices}
                                        value={field.state.value?.value ?? null}
                                        className="h-10 bg-card"
                                        onChange={(val) => {
                                            if (val == null) return;
                                            field.handleChange({
                                                value: val,
                                                label: PROVIDER_LABELS[val] ?? val,
                                            });
                                        }}
                                    />
                                    {field.state.meta.errors.length > 0 ? (
                                        <span className="text-xs text-destructive">
                                            {field.state.meta.errors.join(', ')}
                                        </span>
                                    ) : null}
                                </div>
                            )}
                        </form.Field>
                    )}

                    <form.Field
                        name="name"
                        validators={{
                            onChange: ({ value }) => (!value.trim() ? 'Name is required' : undefined),
                        }}
                    >
                        {(field) => (
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="dataStoreName" className="text-sm font-medium text-text-secondary">
                                    Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="dataStoreName"
                                    placeholder="Product documentation"
                                    value={field.state.value}
                                    onChange={(e) => {
                                        field.handleChange(e.target.value);
                                        if (!isRefNameEditedByUserRef.current) {
                                            form.setFieldValue('refName', nameToRefName(e.target.value));
                                        }
                                    }}
                                    className="h-10 bg-card"
                                />
                                {field.state.meta.errors.length > 0 ? (
                                    <span className="text-xs text-destructive">
                                        {field.state.meta.errors.join(', ')}
                                    </span>
                                ) : null}
                            </div>
                        )}
                    </form.Field>

                    {!isFilesProvider && (
                        <form.Field name="description">
                            {(field) => (
                                <div className="flex flex-col gap-1.5">
                                    <Label className="text-sm font-medium text-text-secondary">Description</Label>
                                    <TextAreaForm
                                        name={field.name}
                                        className="max-h-[100px] min-h-[60px]"
                                        placeholder="Briefly describe what this file contains or how it should be used."
                                        value={field.state.value}
                                        onBlur={field.handleBlur}
                                        onChange={(val) => field.handleChange(val)}
                                    />
                                </div>
                            )}
                        </form.Field>
                    )}

                    <form.Field
                        name="refName"
                        validators={{
                            onChange: ({ value }) => {
                                if (!value) return 'Ref name is required';
                                if (value.includes(' ')) return 'Spaces are not allowed in the ref name.';
                                if (/[A-Z]/.test(value)) return 'Ref name should not contain uppercase letters.';
                                if (!/^[a-z0-9_]+$/.test(value)) {
                                    return 'Ref name should not contain special characters except underscores.';
                                }
                                if (/^\d/.test(value)) return 'Ref name should not start with a number.';

                                return undefined;
                            },
                        }}
                    >
                        {(field) => (
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="dataStoreRefName" className="text-sm font-medium text-text-secondary">
                                    Ref name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="dataStoreRefName"
                                    placeholder="product_documentation"
                                    value={field.state.value}
                                    onChange={(e) => {
                                        isRefNameEditedByUserRef.current = true;
                                        field.handleChange(e.target.value);
                                    }}
                                    className="h-10 bg-card"
                                />
                                {field.state.meta.errors.length > 0 ? (
                                    <span className="text-xs text-destructive">
                                        {field.state.meta.errors.join(', ')}
                                    </span>
                                ) : null}
                            </div>
                        )}
                    </form.Field>

                    {showConnectionFields && (
                        <ConnectionFieldsSection
                            form={form}
                            selectedProvider={selectedProvider}
                            providerOptions={providerOptions}
                            activeOptionIndex={activeOptionIndex}
                            onActiveOptionIndexChange={setActiveOptionIndex}
                            connectionValues={connectionValues}
                        />
                    )}
                    {isWeblinksProvider && (
                        <WeblinksFieldsSection
                            weblinkRows={weblinkRows}
                            setWeblinkRows={setWeblinkRows}
                            expandedWeblinkRowIds={expandedWeblinkRowIds}
                            setExpandedWeblinkRowIds={setExpandedWeblinkRowIds}
                            showWeblinkErrors={showWeblinkErrors}
                        />
                    )}
                    {renderSpecificationField()}
                </form>

                {formError && (
                    <div className={cn('py-2', pickerFormWrapCls)}>
                        <span className="text-sm font-medium text-destructive">{formError}</span>
                    </div>
                )}
            </div>

            <div className="modal-agent-footer sticky bottom-0 z-1 mt-auto border-t border-border bg-card p-4">
                <form.Subscribe selector={(state) => [state.canSubmit, state.isSubmitting]}>
                    {([canSubmit, isSubmitting]) => (
                        <div className={pickerFormWrapCls}>
                            <Button
                                className={cn('h-12 w-full justify-center rounded-2xl text-sm font-semibold')}
                                disabled={!canSubmit || isSubmitting || isPending}
                                onClick={() => void form.handleSubmit()}
                            >
                                {isSubmitting || isPending ? 'Creating...' : CATEGORY_CREATE_BUTTON_LABELS[category]}
                            </Button>
                        </div>
                    )}
                </form.Subscribe>
            </div>
        </div>
    );
};

export default AddDataStorePanel;
