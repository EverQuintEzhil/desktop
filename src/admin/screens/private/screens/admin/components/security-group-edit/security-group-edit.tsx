import { useForm, useStore } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { CheckIcon, PencilIcon, XIcon } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';

import { TagsInput, TagsInputText, type TagSuggestionItem } from '@/admin/components/tags-input';
import { Button } from '@/components/ui/button';
import type { PaginatedSelectData } from '@/components/ui/select';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import SpinnerBlade from '@/components/ui/spinner';
import Tag from '@/components/ui/tag';
import { useCapabilitiesUpdateMutation } from '@/lib/api/admin/capabilities';
import { adminSecurityGroupsApi, SECURITY_GROUPS_LIST_QUERY_KEY } from '@/lib/api/admin/security-groups';
import { adminTagsApi, TAGS_LIST_QUERY_KEY } from '@/lib/api/admin/tags';
import type { ResourceApiType, ResourceType, SecurityGroupType, TagType } from '@/types/admin';

const TAGS_OR_SECURITY_GROUP_SEARCH_PAGE_SIZE = 10;

interface SecurityGroupEditProps<T extends ResourceType> {
    securityGroups: SecurityGroupType[];
    title: string;
    id: string;
    field: string;
    canUserEdit: boolean;
    type: ResourceApiType;
    inputType?: 'select' | 'text';
    isMultiSelect?: boolean;
    renderHeaderAction?: () => ReactNode;
    onSubmit: (value: T) => void;
}

const SecurityGroupEdit = <T extends ResourceType>(props: SecurityGroupEditProps<T>) => {
    const {
        securityGroups,
        title,
        id,
        field,
        canUserEdit,
        type,
        inputType = 'select',
        isMultiSelect = false,
        renderHeaderAction,
        onSubmit,
    } = props;
    const queryClient = useQueryClient();
    const updateMutation = useCapabilitiesUpdateMutation();

    const [isEditing, setIsEditing] = useState(false);
    const [isCloseConfirming, setIsCloseConfirming] = useState(false);

    const form = useForm({
        defaultValues: {
            securtityGroups: securityGroups.map((val) => ({ value: val._id, label: val.name })) || [],
        },
        onSubmit: async ({ value }) => {
            try {
                const obj = {
                    [field]: value.securtityGroups.map((val: { value: string }) => val.value),
                };
                const result = await updateMutation.mutateAsync({ type, id, data: obj });

                onSubmit(result as T);
            } catch (error) {
                console.error(error);
            } finally {
                form.reset();
                setIsEditing(false);
                setIsCloseConfirming(false);
            }
        },
    });

    const isDirty = useStore(form.store, (state) => state.isDirty);

    const fetchSecurityGroups = useCallback(
        async (query: string, page: number = 0): Promise<PaginatedSelectData<string>> => {
            if (field === 'tags') {
                const response = await queryClient.fetchQuery({
                    queryKey: [...TAGS_LIST_QUERY_KEY, 'search', query, page],
                    queryFn: () =>
                        adminTagsApi.list({
                            page,
                            size: TAGS_OR_SECURITY_GROUP_SEARCH_PAGE_SIZE,
                            search: query,
                        }),
                    staleTime: 60_000,
                });

                const list = response.values.map((val: TagType) => ({
                    value: val.name,
                    label: val.name,
                    key: val._id,
                }));

                return {
                    list,
                    pageInfo: {
                        page: response.pageInfo.page,
                        total_pages: response.pageInfo.totalPages,
                    },
                };
            }

            const response = await queryClient.fetchQuery({
                queryKey: [...SECURITY_GROUPS_LIST_QUERY_KEY, 'search', query, page],
                queryFn: () =>
                    adminSecurityGroupsApi.list({
                        page,
                        size: TAGS_OR_SECURITY_GROUP_SEARCH_PAGE_SIZE,
                        search: query,
                    }),
                staleTime: 60_000,
            });

            const list = response.values.map((val: SecurityGroupType) => ({
                value: val._id,
                label: val.name,
                key: val._id,
            }));

            return {
                list,
                pageInfo: {
                    page: response.pageInfo.page,
                    total_pages: response.pageInfo.totalPages,
                },
            };
        },
        [field, queryClient],
    );
    const renderContent = () => {
        if (isEditing) {
            return (
                <form.Field
                    name={'securtityGroups'}
                    children={(fieldValue) =>
                        inputType === 'text' ? (
                            <TagsInputText
                                value={fieldValue.state.value}
                                onChange={(val: TagSuggestionItem<string | number | object | null>[]) => {
                                    fieldValue.handleChange(val as { value: string; label: string }[]);
                                    if (isCloseConfirming) {
                                        setIsCloseConfirming(false);
                                    }
                                }}
                            />
                        ) : (
                            <TagsInput
                                value={fieldValue.state.value}
                                onChange={(val: TagSuggestionItem<string | number | object | null>[]) => {
                                    fieldValue.handleChange(val as { value: string; label: string }[]);
                                    if (isCloseConfirming) {
                                        setIsCloseConfirming(false);
                                    }
                                }}
                                isMultiSelect={isMultiSelect}
                                data={fetchSecurityGroups}
                            />
                        )
                    }
                />
            );
        }
        if (Array.isArray(securityGroups) && securityGroups.length === 0) {
            return (
                <span className="text-sm font-medium text-text-secondary">
                    {field === 'tags' ? `No ${title}` : 'No Security Groups'}
                </span>
            );
        }

        return (
            <div className="tags-group flex flex-wrap items-center gap-2">
                {securityGroups?.map((val: SecurityGroupType) => (
                    <Tag key={`security-group-${field}-${val._id}`}>{val.name}</Tag>
                ))}
            </div>
        );
    };

    return (
        <div className="security-group-row security-group-edit-row security-groups hover-me flex flex-col gap-1">
            <div className="security-group-edit-header flex items-center justify-between">
                <h4>{title}</h4>
                <div className="security-group-edit-header-actions flex items-center gap-2">
                    {renderHeaderAction?.()}
                    {isEditing ? (
                        <div className="security-group-edit-actions flex items-center justify-end gap-2">
                            {isCloseConfirming ? (
                                <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => {
                                        form.reset();
                                        setIsEditing(false);
                                        setIsCloseConfirming(false);
                                    }}
                                >
                                    Confirm
                                </Button>
                            ) : (
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    aria-label="Close editor"
                                    onClick={() => {
                                        if (isDirty) {
                                            setIsCloseConfirming(true);
                                        } else {
                                            form.reset();
                                            setIsEditing(false);
                                        }
                                    }}
                                >
                                    <XIcon />
                                </Button>
                            )}
                            <Button
                                size="icon-sm"
                                disabled={updateMutation.isPending}
                                onClick={() => {
                                    form.handleSubmit();
                                }}
                            >
                                {updateMutation.isPending ? <SpinnerBlade className="scale-75" /> : <CheckIcon />}
                            </Button>
                        </div>
                    ) : (
                        canUserEdit && (
                            <SimpleTooltip content="Edit" side="bottom">
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="on-hover"
                                    onClick={() => {
                                        setIsEditing(!isEditing);

                                        setIsCloseConfirming(false);
                                    }}
                                >
                                    <PencilIcon />
                                </Button>
                            </SimpleTooltip>
                        )
                    )}
                </div>
            </div>
            {renderContent()}
        </div>
    );
};

export default SecurityGroupEdit;
