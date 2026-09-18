import { useForm, useStore } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { CheckIcon, PencilIcon, XIcon } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';

import { TagsInput, type TagSuggestionItem } from '@/admin/components/tags-input';
import { Button } from '@/components/ui/button';
import type { PaginatedSelectData } from '@/components/ui/select';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import SpinnerBlade from '@/components/ui/spinner';
import Tag from '@/components/ui/tag';
import { useCapabilitiesUpdateMutation } from '@/lib/api/admin/capabilities';
import { adminUsersApi, USERS_LIST_QUERY_KEY } from '@/lib/api/admin/users';
import type { UserType, ResourceType, ResourceApiType } from '@/types/admin';

const USERS_SEARCH_PAGE_SIZE = 10;

interface UsersEditProps<T extends ResourceType> {
    users: UserType[];
    title: string;
    id: string;
    type: ResourceApiType;
    field: string;
    canUserEdit: boolean;
    isMultiSelect?: boolean;
    renderHeaderAction?: () => ReactNode;
    onSubmit: (value: T) => void;
}

const UsersEdit = <T extends ResourceType>(props: UsersEditProps<T>) => {
    const { users, title, id, type, field, canUserEdit, isMultiSelect = false, renderHeaderAction, onSubmit } = props;
    const queryClient = useQueryClient();
    const updateMutation = useCapabilitiesUpdateMutation();

    const [isEditing, setIsEditing] = useState(false);
    const [isCloseConfirming, setIsCloseConfirming] = useState(false);

    const form = useForm({
        defaultValues: {
            users: users.map((val) => ({ value: val._id, label: val.name?.first + ' ' + val.name?.last })) || [],
        },
        onSubmit: async ({ value }) => {
            try {
                const obj = {
                    [field]: value.users.map((val: { value: string }) => val.value),
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

    const fetchUsers = useCallback(
        async (query: string, page: number = 0): Promise<PaginatedSelectData<string>> => {
            const response = await queryClient.fetchQuery({
                queryKey: [...USERS_LIST_QUERY_KEY, 'search', query, page],
                queryFn: () =>
                    adminUsersApi.list({
                        page,
                        size: USERS_SEARCH_PAGE_SIZE,
                        search: query,
                    }),
                staleTime: 60_000,
            });

            const list = response.values.map((val: UserType) => ({
                value: val._id,
                label: `${val.name.first} ${val.name.last}`,
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
        [queryClient],
    );

    const renderContent = () => {
        if (isEditing) {
            return (
                <form.Field
                    name={'users'}
                    children={(field) => (
                        <TagsInput
                            value={field.state.value}
                            onChange={(e: TagSuggestionItem<string | number | object | null>[]) => {
                                field.handleChange(e as { value: string; label: string }[]);
                                if (isCloseConfirming) {
                                    setIsCloseConfirming(false);
                                }
                            }}
                            data={fetchUsers}
                            isMultiSelect={isMultiSelect}
                        />
                    )}
                />
            );
        }
        if (Array.isArray(users) && users.length === 0) {
            return <span className="text-sm font-medium text-text-secondary">No Users</span>;
        }

        return (
            <div className="tags-group flex flex-wrap items-center gap-2">
                {users?.map((val: UserType) => (
                    <Tag key={`member-${field}-${val._id}`}>
                        {val.name?.first} {val.name?.last}
                    </Tag>
                ))}
            </div>
        );
    };

    return (
        <div className="security-group-row members hover-me flex flex-col gap-2">
            <div className="users-edit-header flex items-center justify-between">
                <h4>{title}</h4>
                <div className="users-edit-header-actions flex items-center gap-2">
                    {renderHeaderAction?.()}
                    {isEditing ? (
                        <div className="users-edit-actions flex items-center justify-end gap-2">
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

export default UsersEdit;
