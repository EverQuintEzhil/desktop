import { useForm } from '@tanstack/react-form';
import { useState } from 'react';
import type { Content } from 'vanilla-jsoneditor';

import JSONEditor from '@/components/json-editor';
import { Button } from '@/components/ui/button';

import './data-stores-specification.scss';
import SpinnerBlade from '@/components/ui/spinner';
import { useWizardSaveConnectionMutation } from '@/lib/api/admin/data-stores';
import type { DataStoreType } from '@/types/admin';
import { showErrorToast, parseJsonIfValid, showSuccessToast } from '@/utils';

interface Props {
    dataStore: DataStoreType;
    canUserEdit: boolean;
    onSubmit: (data: DataStoreType) => void;
}

export type DataStoresSpecificationType = {
    readonly _id: string;
    specification: string;
};

const DataStoresSpecification = (props: Props) => {
    const saveConnectionMutation = useWizardSaveConnectionMutation();
    const { dataStore, canUserEdit, onSubmit } = props;
    const [state, setState] = useState({
        data: {} as DataStoresSpecificationType,
        error: false,
    });

    const [isSubmitting, setIsSubmitting] = useState(false);

    const form = useForm({
        defaultValues: {
            specification: { json: dataStore.specification ?? {} } as Content,
        },
        onSubmit: async ({ value }) => {
            onSave(value);
        },
    });

    const onSave = async (value: { specification: Content }) => {
        setIsSubmitting(true);
        try {
            const finalSpecification = parseJsonIfValid(value.specification);
            const obj = {
                specification: finalSpecification,
            };
            const result = await saveConnectionMutation.mutateAsync({
                id: dataStore._id,
                data: obj,
            });

            setState({
                ...state,
                data: result as DataStoresSpecificationType,
                error: false,
            });

            onSubmit(result);

            showSuccessToast('Specification saved successfully.');
        } catch (error) {
            console.error(error);
            showErrorToast('Failed to save specification. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    if (state.error) {
        return (
            <div className="flex items-center justify-center px-4 py-6">
                <div className="flex flex-col items-center justify-center gap-6">
                    <h2 className="text-center font-medium">Error</h2>
                </div>
            </div>
        );
    }

    return (
        <div className="tab-content specification-tab flex flex-col gap-2">
            {canUserEdit && (
                <Button onClick={form.handleSubmit} size="sm" className="ml-auto flex" disabled={isSubmitting}>
                    {isSubmitting ? <SpinnerBlade className="scale-75" /> : null}
                    {isSubmitting ? 'Saving' : 'Save'}
                </Button>
            )}
            <form.Field
                name="specification"
                children={(field) => (
                    <JSONEditor
                        isErrored={false}
                        content={field.state.value}
                        readOnly={!canUserEdit}
                        onBlur={field.handleBlur}
                        onChange={(content: Content) => {
                            field.handleChange(content);
                        }}
                    />
                )}
                validators={{
                    onChange: ({ value }) => {
                        const parsedCurrentValue = parseJsonIfValid(value);

                        if (!parsedCurrentValue) {
                            return 'Configuration Secret is required';
                        }

                        return null;
                    },
                }}
            />
        </div>
    );
};

export default DataStoresSpecification;
