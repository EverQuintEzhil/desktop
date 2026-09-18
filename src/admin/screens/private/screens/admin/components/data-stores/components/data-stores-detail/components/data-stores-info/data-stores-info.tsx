import { useForm } from '@tanstack/react-form';
import { CheckIcon, ExternalLinkIcon, PencilIcon, XIcon } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

import { Button } from '@/components/ui/button';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import SpinnerBlade from '@/components/ui/spinner';
import Tag from '@/components/ui/tag';
import TextAreaForm from '@/components/ui/textarea-form';
import { useUpdateDataStoreMutation } from '@/lib/api/admin/data-stores';
import type { DataStoreType } from '@/types/admin';

import { SecurityGroupEdit } from '../../../../../security-group-edit';
import { UsersEdit } from '../../../../../users-edit';
import '../../data-stores-detail.scss';

import './data-stores-info.scss';

interface Props {
    dataStore: DataStoreType;
    canUserEdit: boolean;
    onSubmit: (value: DataStoreType) => void;
}

const DataStoresInfo = (props: Props) => {
    const { dataStore, onSubmit, canUserEdit } = props;
    const updateMutation = useUpdateDataStoreMutation();
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isEditing, setIsEditing] = useState('');

    const onSave = async (value: { description: string }) => {
        setIsSubmitting(true);
        try {
            const obj = {
                description: isEditing === 'description' ? value.description : undefined,
            };
            const result = await updateMutation.mutateAsync({
                id: dataStore._id,
                data: obj,
            });

            onSubmit(result);
        } catch (error) {
            console.error(error);
        } finally {
            setIsSubmitting(false);
            setIsEditing('');
        }
    };

    const form = useForm({
        defaultValues: {
            description: dataStore?.description || '',
        },
        onSubmit: async ({ value }) => {
            onSave(value);
        },
    });

    return (
        <div className="tab-content data-stores-tab flex flex-col">
            <div className="description-block hover-me flex flex-col gap-2">
                <div className="flex items-center justify-between">
                    <h4>Description</h4>
                    {isEditing === 'description' ? (
                        <div className="data-stores-info-actions flex items-center justify-end gap-2">
                            <Button variant="ghost" size="icon-sm" onClick={() => setIsEditing('')}>
                                <XIcon />
                            </Button>
                            <Button
                                variant="default"
                                size="icon-sm"
                                onClick={form.handleSubmit}
                                disabled={isSubmitting}
                            >
                                {isSubmitting ? <SpinnerBlade /> : <CheckIcon />}
                            </Button>
                        </div>
                    ) : (
                        canUserEdit && (
                            <SimpleTooltip content="Edit" side="bottom">
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="on-hover"
                                    onClick={() => setIsEditing('description')}
                                >
                                    <PencilIcon />
                                </Button>
                            </SimpleTooltip>
                        )
                    )}
                </div>
                {isEditing === 'description' ? (
                    <div className="data-stores-info-editor data-stores-info-textarea flex flex-col gap-2">
                        <form.Field
                            name="description"
                            children={(field) => (
                                <TextAreaForm
                                    name={field.name}
                                    isErrored={false}
                                    value={field.state.value}
                                    onBlur={field.handleBlur}
                                    onChange={(val) => field.handleChange(val)}
                                />
                            )}
                        />
                    </div>
                ) : (
                    <p
                        className="description-readable"
                        onClick={() => canUserEdit && setIsEditing('description')}
                        role="presentation"
                    >
                        {dataStore.description}
                    </p>
                )}
            </div>
            <div className="security-group-row members flex flex-col gap-2">
                <div className="users-edit-header flex items-center justify-between">
                    <h4>Tools</h4>
                </div>
                {dataStore.tools && dataStore.tools.length > 0 ? (
                    <div className="tags-group flex flex-wrap items-center gap-2">
                        {dataStore.tools.map((tool) => (
                            <Link key={`tool-${tool._id}`} to={`/admin/tools/${tool._id}`}>
                                <Tag
                                    className="cursor-pointer transition-colors"
                                    rightIcon={ExternalLinkIcon}
                                    rightIconProps={{ size: 14 }}
                                >
                                    {tool.name}
                                </Tag>
                            </Link>
                        ))}
                    </div>
                ) : (
                    <span className="text-sm font-medium text-text-secondary">No Tools</span>
                )}
            </div>
            <UsersEdit
                users={dataStore.includeUsers || []}
                title="Included Users"
                id={dataStore._id}
                type={'datastores'}
                canUserEdit={canUserEdit}
                field="includeUserIds"
                onSubmit={onSubmit}
            />
            <SecurityGroupEdit
                securityGroups={dataStore.includeSecurityGroups || []}
                title="Included Security Groups"
                id={dataStore._id}
                type={'datastores'}
                canUserEdit={canUserEdit}
                field="includeSecurityGroupIds"
                onSubmit={onSubmit}
            />
            <UsersEdit
                users={dataStore.excludeUsers || []}
                title="Excluded Users"
                id={dataStore._id}
                type={'datastores'}
                canUserEdit={canUserEdit}
                field="excludeUserIds"
                onSubmit={onSubmit}
            />
            <SecurityGroupEdit
                securityGroups={dataStore.excludeSecurityGroups || []}
                title="Excluded Security Groups"
                id={dataStore._id}
                type={'datastores'}
                canUserEdit={canUserEdit}
                field="excludeSecurityGroupIds"
                onSubmit={onSubmit}
            />
        </div>
    );
};

export default DataStoresInfo;
