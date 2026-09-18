import { useForm, useStore } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { Loader2Icon, XIcon } from 'lucide-react';
import { useEffect, useState } from 'react';

import { nameToRefName, panelBtnCls } from '@/app/components/picker/picker-shared';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import Select from '@/components/ui/select';
import TextAreaForm from '@/components/ui/textarea-form';
import { useUpdateDataStoreMutation } from '@/lib/api/admin/data-stores';
import { PROVIDER_OPTIONS, type DataStoreType, type ProviderType } from '@/types/admin';
import { showSuccessToast } from '@/utils';

interface DataStoreDetailsModalProps {
    dataStore: DataStoreType;
    isOpen: boolean;
    onClose: () => void;
    onUpdated?: (dataStore: { _id: string; name: string }) => void;
}

export const DataStoreDetailsModal = ({ dataStore, isOpen, onClose, onUpdated }: DataStoreDetailsModalProps) => {
    const queryClient = useQueryClient();
    const updateMutation = useUpdateDataStoreMutation();
    const [formError, setFormError] = useState('');

    const isFilesProvider = dataStore.provider === 'files';

    const form = useForm({
        defaultValues: {
            name: dataStore.name ?? '',
            description: dataStore.description ?? '',
            refName: dataStore.refName ?? '',
        },
        onSubmit: async ({ value }) => {
            setFormError('');

            try {
                const data: Record<string, string> = {
                    name: value.name.trim(),
                    refName: value.refName.trim(),
                };

                if (!isFilesProvider) {
                    data.description = value.description.trim();
                }

                const updated = await updateMutation.mutateAsync({ id: dataStore._id, data });

                await queryClient.invalidateQueries({ queryKey: ['create-agent', 'datastores'] });
                onUpdated?.({ _id: dataStore._id, name: updated?.name ?? data.name });
                showSuccessToast('Data store updated successfully.');
                onClose();
            } catch (error: unknown) {
                const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
                const message = axiosError.response?.data?.message || 'Failed to update data store.';

                setFormError(
                    axiosError.response?.status === 500 ? 'Internal server error, Please try again.' : message,
                );
            }
        },
    });

    const formValues = useStore(form.store, (state) => state.values);

    useEffect(() => {
        if (formError) {
            setFormError('');
        }
    }, [formValues]);

    const handleOpenChange = (next: boolean) => {
        if (!next && !updateMutation.isPending) {
            onClose();
        }
    };

    const handleNameChange = (previousName: string, nextName: string) => {
        if (form.getFieldValue('refName') === nameToRefName(previousName)) {
            form.setFieldValue('refName', nameToRefName(nextName));
        }
    };

    const renderDescriptionField = () => {
        if (isFilesProvider) return null;

        return (
            <form.Field name="description">
                {(field) => (
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-sm font-medium text-text-secondary">Description</Label>
                        <TextAreaForm
                            name={field.name}
                            className="max-h-[100px] min-h-[60px]"
                            placeholder="Briefly describe what this store contains or how it should be used."
                            value={field.state.value}
                            onBlur={field.handleBlur}
                            onChange={(val) => field.handleChange(val)}
                        />
                    </div>
                )}
            </form.Field>
        );
    };

    const renderFormError = () => {
        if (!formError) return null;

        return <span className="text-sm font-medium text-destructive">{formError}</span>;
    };

    return (
        <Dialog open={isOpen} onOpenChange={handleOpenChange}>
            <DialogContent className="gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-[520px]">
                <DialogHeader className="flex-row items-center justify-between gap-3 px-5 py-4">
                    <DialogTitle className="text-lg font-medium tracking-[-0.03em] text-(--text-primary)">
                        Edit data store
                    </DialogTitle>
                    <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Close"
                        onClick={onClose}
                        disabled={updateMutation.isPending}
                        className={`-mr-1.5 shrink-0 ${panelBtnCls}`}
                    >
                        <XIcon size={17} aria-hidden="true" />
                    </Button>
                </DialogHeader>

                <form
                    id="data-store-details-form"
                    onSubmit={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        void form.handleSubmit();
                    }}
                    className="scrollbar-controller scrollbar-vertical flex max-h-[65svh] flex-col gap-5 px-5 py-6"
                >
                    <div className="flex flex-col gap-1.5">
                        <Label className="text-sm font-medium text-text-secondary">Provider</Label>
                        <Select<ProviderType>
                            variant="ghost"
                            placeholder="Select"
                            options={PROVIDER_OPTIONS}
                            value={dataStore.provider}
                            className="h-10 bg-card"
                            disabled
                            onChange={() => undefined}
                        />
                        <span className="text-xs text-text-secondary">
                            The provider can&apos;t be changed after the store is created.
                        </span>
                    </div>

                    <form.Field
                        name="name"
                        validators={{
                            onChange: ({ value }) => (!value.trim() ? 'Name is required' : undefined),
                        }}
                    >
                        {(field) => (
                            <div className="flex flex-col gap-1.5">
                                <Label htmlFor="editDataStoreName" className="text-sm font-medium text-text-secondary">
                                    Name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="editDataStoreName"
                                    placeholder="Product documentation"
                                    value={field.state.value}
                                    onChange={(e) => {
                                        handleNameChange(field.state.value, e.target.value);
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

                    {renderDescriptionField()}

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
                                <Label
                                    htmlFor="editDataStoreRefName"
                                    className="text-sm font-medium text-text-secondary"
                                >
                                    Ref name <span className="text-destructive">*</span>
                                </Label>
                                <Input
                                    id="editDataStoreRefName"
                                    placeholder="product_documentation"
                                    value={field.state.value}
                                    onChange={(e) => field.handleChange(e.target.value)}
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

                    {renderFormError()}
                </form>

                <DialogFooter className="justify-end gap-2 border-t border-border px-5 py-4">
                    <Button
                        variant="outline"
                        size="sm"
                        className="rounded-[12px] px-4"
                        onClick={onClose}
                        disabled={updateMutation.isPending}
                    >
                        Cancel
                    </Button>
                    <form.Subscribe selector={(state) => [state.canSubmit, state.isDirty]}>
                        {([canSubmit, isDirty]) => (
                            <Button
                                type="submit"
                                form="data-store-details-form"
                                size="sm"
                                className="rounded-[12px] px-4"
                                disabled={!canSubmit || !isDirty || updateMutation.isPending}
                            >
                                {updateMutation.isPending ? (
                                    <Loader2Icon className="size-4 animate-spin" aria-hidden="true" />
                                ) : null}
                                {updateMutation.isPending ? 'Saving...' : 'Save changes'}
                            </Button>
                        )}
                    </form.Subscribe>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};
