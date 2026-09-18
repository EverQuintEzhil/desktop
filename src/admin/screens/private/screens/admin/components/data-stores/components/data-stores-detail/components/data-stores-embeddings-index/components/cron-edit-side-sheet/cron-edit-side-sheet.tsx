import { useForm, useStore } from '@tanstack/react-form';
import { useEffect, useState } from 'react';

import { CronGenerator } from '@/components';
import { Button } from '@/components/ui/button';
import FormField from '@/components/ui/form-field';
import SideSheet from '@/components/ui/side-sheet';
import SpinnerBlade from '@/components/ui/spinner';
import { useWizardSaveCronMutation } from '@/lib/api/admin/data-stores';
import type { DataStoreType } from '@/types/admin';

interface Props {
    onClose: () => void;
    isOpen: boolean;
    onEditCron: (dataStore: DataStoreType) => void;
    cron: string;
    dataStore: DataStoreType;
}

const EditCronSideSheet = (props: Props) => {
    const { onClose: onCloseProp, isOpen, onEditCron, cron, dataStore } = props;

    const saveCronMutation = useWizardSaveCronMutation();
    const [formError, setFormError] = useState('');

    const form = useForm({
        defaultValues: {
            cron: cron ?? '',
        },
        onSubmit: async ({ value }) => {
            setFormError('');
            try {
                const obj = {
                    cron: value.cron,
                };

                const result = await saveCronMutation.mutateAsync({
                    id: dataStore._id,
                    data: obj,
                });

                onEditCron?.(result as DataStoreType);
                onClose();
            } catch (error: unknown) {
                console.error(error);
                const axiosError = error as { response?: { data?: { message?: string }; status?: number } };
                const message = axiosError.response?.data?.message || 'Something went wrong. Please try again.';

                if (axiosError.response?.status === 500) {
                    setFormError('Internal server error, Please try again.');
                } else {
                    setFormError(message);
                }
            }
        },
    });

    const isDirty = useStore(form.store, (state) => state.isDirty);

    const formValues = useStore(form.store, (state) => state.values);

    useEffect(() => {
        if (formError) {
            setFormError('');
        }
    }, [formValues]);

    const onClose = () => {
        form.reset({
            cron: cron ?? '',
        });
        setFormError('');
        onCloseProp();
    };

    return (
        <SideSheet
            isOpen={isOpen}
            onClose={onClose}
            renderTitle={() => <>{'Edit Cron'}</>}
            renderFooter={() => (
                <Button
                    onClick={form.handleSubmit}
                    className="add-auth-token-save-button ml-auto flex"
                    disabled={saveCronMutation.isPending}
                >
                    {saveCronMutation.isPending ? <SpinnerBlade className="scale-75" /> : null}
                    {saveCronMutation.isPending ? 'Saving' : 'Save'}
                </Button>
            )}
            showConfirmOnClose={isDirty}
            classNameContent="flex flex-col add-auth-token-content pb-0"
        >
            <div className="flex flex-col gap-4 pb-4">
                <form.Field
                    name="cron"
                    children={(field) => (
                        <FormField label="Cron" field={field} required>
                            {() => (
                                <CronGenerator
                                    value={field.state.value}
                                    onChange={(value) => field.handleChange(value)}
                                />
                            )}
                        </FormField>
                    )}
                    validators={{
                        onChange: ({ value }) => {
                            if (!value) {
                                return 'Name is required';
                            }

                            return null;
                        },
                    }}
                />
            </div>
            {formError && (
                <div className="sticky bottom-0 z-1 mt-auto bg-card py-2">
                    <span className="text-sm font-medium text-destructive">{formError}</span>
                </div>
            )}
        </SideSheet>
    );
};

export default EditCronSideSheet;
