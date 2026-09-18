import { useForm, useStore } from '@tanstack/react-form';
import { useQueryClient } from '@tanstack/react-query';
import { CheckIcon, ExternalLinkIcon, PencilIcon, SendIcon, XIcon } from 'lucide-react';
import { type ReactNode, useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { TagsInput, TagsInputText, type TagSuggestionItem } from '@/admin/components/tags-input';
import { Button } from '@/components/ui/button';
import type { PaginatedSelectData } from '@/components/ui/select';
import { SimpleTooltip } from '@/components/ui/simple-tooltip';
import SpinnerBlade, { Spinner } from '@/components/ui/spinner';
import Tag from '@/components/ui/tag';
import {
    ATTACHABLE_MEMORY_KINDS,
    CAPABILITIES_QUERY_KEY,
    adminCapabilitiesApi,
    useCapabilitiesUpdateMutation,
} from '@/lib/api/admin/capabilities';
import {
    capabilityListDisplayLabel,
    type ResourceType,
    type ResourceApiType,
    type CapabilitiesType,
    type CapabilitiesData,
    type CapabilityListEntry,
    type TagForEnum,
    type BlogPostTypeEnum,
} from '@/types/admin';

const CAPABILITY_SEARCH_PAGE_SIZE = 10;

interface CapabilitiesEditProps<T extends ResourceType> {
    capabilities: CapabilitiesData;
    title: string;
    id: string;
    type: ResourceApiType;
    capabilitiesType: CapabilitiesType;
    field: string;
    canUserEdit: boolean;
    onSubmit: (value: T) => void | Promise<void>;
    headerSlot?: ReactNode;
    executeTools?: () => void;
    isMultiSelect?: boolean;
    getTagTo?: (capability: CapabilityListEntry) => string;
    inputType?: 'select' | 'text';
    tagFor?: TagForEnum;
    postTypes?: BlogPostTypeEnum[];
    notAllowedOptionIds?: string[];
    defaultCapabilityId?: string | string[];
    getDefaultCapabilitySubmitData?: (capabilityId: string | undefined) => Record<string, unknown>;
    showDefaultCapabilityStar?: boolean;
    defaultCapabilityNoteText?: string;
    defaultCapabilityLoading?: boolean;
    formatCapabilitiesForSubmit?: (ids: string[], defaultId?: string | string[]) => Record<string, unknown>;
}

const CapabilitiesEdit = <T extends ResourceType>(props: CapabilitiesEditProps<T>) => {
    const {
        capabilities,
        title,
        id,
        type,
        capabilitiesType,
        field,
        canUserEdit,
        onSubmit,
        headerSlot,
        executeTools,
        getTagTo,
        isMultiSelect = false,
        notAllowedOptionIds,
        defaultCapabilityId,
        getDefaultCapabilitySubmitData,
        showDefaultCapabilityStar = false,
        defaultCapabilityNoteText = 'Select a tag to set it as the default capability.',
        defaultCapabilityLoading,
        inputType = 'select',
        tagFor,
        postTypes,
        formatCapabilitiesForSubmit,
    } = props;
    const queryClient = useQueryClient();
    const updateMutation = useCapabilitiesUpdateMutation();

    const [isEditing, setIsEditing] = useState(false);
    const [isCloseConfirming, setIsCloseConfirming] = useState(false);
    const [draftDefaultCapabilityId, setDraftDefaultCapabilityId] = useState(defaultCapabilityId);
    const isDefaultCapabilityDirty =
        Array.isArray(draftDefaultCapabilityId) && Array.isArray(defaultCapabilityId)
            ? draftDefaultCapabilityId.length !== defaultCapabilityId.length ||
              draftDefaultCapabilityId.some((id) => !defaultCapabilityId.includes(id))
            : draftDefaultCapabilityId !== defaultCapabilityId;
    const effectiveDefaultCapabilityId = isEditing ? draftDefaultCapabilityId : defaultCapabilityId;

    useEffect(() => {
        if (!isEditing) {
            setDraftDefaultCapabilityId(defaultCapabilityId);
        }
    }, [defaultCapabilityId, isEditing]);

    const isLockedCapability = (val: CapabilityListEntry) =>
        capabilitiesType === 'memories' && 'kind' in val && val.kind === 'conversation';

    // tanstack/react-form re-seeds values from defaultValues on any untouched-field render.
    const [capabilitiesSnapshot, setCapabilitiesSnapshot] = useState(capabilities);

    useEffect(() => {
        if (!isEditing) {
            setCapabilitiesSnapshot(capabilities);
        }
    }, [capabilities, isEditing]);

    const form = useForm({
        defaultValues: {
            capabilities:
                capabilitiesSnapshot.map((val) => ({
                    value: val._id,
                    label: capabilityListDisplayLabel(val, capabilitiesType),
                    // Conversation memories are managed via conversationsEnabled — not removable here.
                    removable: !isLockedCapability(val),
                })) || [],
        },
        onSubmit: async ({ value }) => {
            try {
                const lockedIds = capabilities.filter(isLockedCapability).map((val) => val._id);
                const capabilityIds = [
                    ...new Set([...lockedIds, ...value.capabilities.map((val: { value: string }) => val.value)]),
                ];
                const defaultCapabilitySubmitData =
                    isDefaultCapabilityDirty && getDefaultCapabilitySubmitData
                        ? getDefaultCapabilitySubmitData(
                              Array.isArray(draftDefaultCapabilityId) ? undefined : draftDefaultCapabilityId,
                          )
                        : {};
                const capabilitiesPayload = formatCapabilitiesForSubmit
                    ? formatCapabilitiesForSubmit(capabilityIds, draftDefaultCapabilityId)
                    : { [field]: capabilityIds };
                const obj = {
                    ...capabilitiesPayload,
                    ...defaultCapabilitySubmitData,
                };
                const response = await updateMutation.mutateAsync({ type, id, data: obj });

                await onSubmit(response as T);
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
    const isSubmitting = useStore(form.store, (state) => state.isSubmitting);
    const hasPendingChanges = isDirty || isDefaultCapabilityDirty;

    const handleDefaultCapabilityChange = (capability: TagSuggestionItem | undefined, selected?: boolean) => {
        const selectedDefaultCapabilityId = typeof capability?.value === 'string' ? capability.value : undefined;

        setDraftDefaultCapabilityId((prev) => {
            if (Array.isArray(prev) || Array.isArray(defaultCapabilityId)) {
                let currentArray: string[] = [];

                if (Array.isArray(prev)) {
                    currentArray = prev;
                } else if (prev) {
                    currentArray = [prev];
                }

                if (selectedDefaultCapabilityId) {
                    if (!selected && currentArray.includes(selectedDefaultCapabilityId)) {
                        return currentArray.filter((id) => id !== selectedDefaultCapabilityId);
                    }
                    if (selected && !currentArray.includes(selectedDefaultCapabilityId)) {
                        return [...currentArray, selectedDefaultCapabilityId];
                    }
                }

                return prev;
            }

            if (selected) {
                return selectedDefaultCapabilityId;
            }

            return undefined;
        });

        if (isCloseConfirming) {
            setIsCloseConfirming(false);
        }
    };

    const fetchCapabilities = useCallback(
        async (query: string, page: number = 0): Promise<PaginatedSelectData<string>> => {
            const response = await queryClient.fetchQuery({
                queryKey: [
                    ...CAPABILITIES_QUERY_KEY,
                    'search',
                    capabilitiesType,
                    query,
                    page,
                    capabilitiesType === 'memories' ? ATTACHABLE_MEMORY_KINDS : null,
                    tagFor ?? null,
                    postTypes ?? null,
                ],
                queryFn: () =>
                    adminCapabilitiesApi.search<CapabilityListEntry>(capabilitiesType, {
                        page,
                        size: CAPABILITY_SEARCH_PAGE_SIZE,
                        search: query,
                        ...(capabilitiesType === 'memories' ? { kind: ATTACHABLE_MEMORY_KINDS } : {}),
                        ...(capabilitiesType === 'tags' && tagFor ? { tagFor } : {}),
                        ...(capabilitiesType === 'blogposts' && postTypes ? { types: postTypes } : {}),
                    }),
                staleTime: 60_000,
            });

            const list = response.values
                .filter((val: CapabilityListEntry) => !notAllowedOptionIds?.includes(val._id))
                .map((val: CapabilityListEntry) => ({
                    value: val._id,
                    label: capabilityListDisplayLabel(val, capabilitiesType),
                    key: val._id,
                }));

            return {
                list,
                pageInfo: {
                    page: response.page_info.page,
                    total_pages: response.page_info.total_pages,
                },
            };
        },
        [capabilitiesType, notAllowedOptionIds, queryClient, tagFor, postTypes],
    );

    const renderContent = () => {
        if (isEditing) {
            return (
                <>
                    <form.Field
                        name={'capabilities'}
                        children={(field) =>
                            inputType === 'text' ? (
                                <TagsInputText
                                    addNewlabel={`Add ${title}`}
                                    value={field.state.value}
                                    onChange={(e: TagSuggestionItem<string | number | object | null>[]) => {
                                        field.handleChange(e as { value: string; label: string; removable: boolean }[]);
                                        if (isCloseConfirming) {
                                            setIsCloseConfirming(false);
                                        }
                                    }}
                                />
                            ) : (
                                <TagsInput
                                    addNewlabel={`Add ${title}`}
                                    value={field.state.value}
                                    onChange={(e: TagSuggestionItem<string | number | object | null>[]) => {
                                        field.handleChange(e as { value: string; label: string; removable: boolean }[]);
                                        if (isCloseConfirming) {
                                            setIsCloseConfirming(false);
                                        }
                                    }}
                                    isMultiSelect={isMultiSelect}
                                    defaultItemValue={effectiveDefaultCapabilityId}
                                    onDefaultItemChange={
                                        getDefaultCapabilitySubmitData || formatCapabilitiesForSubmit
                                            ? handleDefaultCapabilityChange
                                            : undefined
                                    }
                                    showDefaultItemStar={showDefaultCapabilityStar}
                                    defaultItemLoading={defaultCapabilityLoading}
                                    data={fetchCapabilities}
                                />
                            )
                        }
                    />
                    {(getDefaultCapabilitySubmitData || formatCapabilitiesForSubmit) && showDefaultCapabilityStar && (
                        <p className="mt-2 text-xs text-text-secondary">
                            <b>Note: </b>
                            {defaultCapabilityNoteText}
                        </p>
                    )}
                </>
            );
        }
        if (Array.isArray(capabilities) && capabilities.length === 0) {
            return (
                <span className="text-sm font-medium text-text-secondary">
                    No &nbsp;
                    {title}
                </span>
            );
        }

        return (
            <div className="tags-group flex flex-wrap items-center gap-2">
                {(capabilities as CapabilitiesData)?.map((val) => {
                    const to = getTagTo?.(val);
                    const rowKey = `member-${field}-${val._id}`;
                    const isDefaultCapability = Array.isArray(effectiveDefaultCapabilityId)
                        ? effectiveDefaultCapabilityId.includes(val._id)
                        : effectiveDefaultCapabilityId === val._id;
                    const isDefaultCapabilityLoading = defaultCapabilityLoading && isDefaultCapability;

                    if (to) {
                        return (
                            <Link key={rowKey} to={to} className="contents text-inherit no-underline">
                                <Tag
                                    className="cursor-pointer!"
                                    iconSlot={
                                        isDefaultCapabilityLoading ? (
                                            <Spinner className="size-3.5 text-amber-500" />
                                        ) : undefined
                                    }
                                    rightIcon={ExternalLinkIcon}
                                    rightIconProps={{ size: 14 }}
                                    selected={isDefaultCapability}
                                    showStarOnSelected={showDefaultCapabilityStar && !isDefaultCapabilityLoading}
                                >
                                    {capabilityListDisplayLabel(val, capabilitiesType)}
                                </Tag>
                            </Link>
                        );
                    }

                    return (
                        <Tag
                            key={rowKey}
                            selected={isDefaultCapability}
                            iconSlot={
                                isDefaultCapabilityLoading ? <Spinner className="size-3.5 text-amber-500" /> : undefined
                            }
                            showStarOnSelected={showDefaultCapabilityStar && !isDefaultCapabilityLoading}
                        >
                            {capabilityListDisplayLabel(val, capabilitiesType)}
                        </Tag>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="security-group-row members hover-me flex flex-col gap-2">
            <div className="users-edit-header flex items-center justify-between gap-3">
                <h4>{title}</h4>
                {headerSlot && (
                    <div className="ml-auto flex min-w-0 flex-wrap items-center justify-end gap-x-4 gap-y-1">
                        {headerSlot}
                    </div>
                )}
                {isEditing ? (
                    <div className="users-edit-actions flex items-center justify-end gap-2">
                        {isCloseConfirming ? (
                            <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => {
                                    form.reset();
                                    setDraftDefaultCapabilityId(defaultCapabilityId);
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
                                    if (hasPendingChanges) {
                                        setIsCloseConfirming(true);
                                    } else {
                                        form.reset();
                                        setDraftDefaultCapabilityId(defaultCapabilityId);
                                        setIsEditing(false);
                                    }
                                }}
                            >
                                <XIcon />
                            </Button>
                        )}
                        <Button
                            size="icon-sm"
                            disabled={isSubmitting || updateMutation.isPending || defaultCapabilityLoading}
                            onClick={() => {
                                form.handleSubmit();
                            }}
                        >
                            {isSubmitting || updateMutation.isPending || defaultCapabilityLoading ? (
                                <SpinnerBlade className="scale-75" />
                            ) : (
                                <CheckIcon />
                            )}
                        </Button>
                    </div>
                ) : (
                    canUserEdit && (
                        <div className="flex items-center gap-2">
                            {executeTools && (
                                <SimpleTooltip content="Execute tools" side="bottom">
                                    <Button
                                        variant="ghost"
                                        size="sm"
                                        className="on-hover"
                                        onClick={() => executeTools()}
                                    >
                                        <SendIcon className="size-4" />
                                        Execute
                                    </Button>
                                </SimpleTooltip>
                            )}
                            <SimpleTooltip content="Edit" side="bottom">
                                <Button
                                    variant="ghost"
                                    size="icon-sm"
                                    className="on-hover"
                                    onClick={() => {
                                        setIsEditing(!isEditing);
                                        setIsCloseConfirming(false);
                                        setDraftDefaultCapabilityId(defaultCapabilityId);
                                    }}
                                >
                                    <PencilIcon />
                                </Button>
                            </SimpleTooltip>
                        </div>
                    )
                )}
            </div>
            {renderContent()}
        </div>
    );
};

export default CapabilitiesEdit;
