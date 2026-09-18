import { useEffect, useRef, useState } from 'react';

import AutoComplete from '@/components/auto-complete';
import Tag from '@/components/ui/tag';

import { tagSuggestionsEqual } from './tag-suggestion-utils';
import { type TagSuggestionItem, type AddTagProps } from './tags-input.types';

const AddTag = ({
    addNewlabel,
    data,
    disabled,
    isMultiSelect = false,
    newSuggestion,
    onNewTags,
    selected,
    onBlur,
    onKeyDown: onKeyDownFromParent,
    size = 'regular',
    ...rest
}: AddTagProps) => {
    const [showInput, setShowInput] = useState(false);
    const [value, setValue] = useState({ value: '', label: '' });
    const [isBlur, setIsBlur] = useState(false);
    const [pendingTags, setPendingTags] = useState<TagSuggestionItem[]>([]);
    const pendingTagsRef = useRef<TagSuggestionItem[]>([]);

    pendingTagsRef.current = pendingTags;

    const togglePendingTag = (tag: TagSuggestionItem) => {
        setPendingTags((prev) => {
            const exists = prev.some((t) => tagSuggestionsEqual(t, tag));

            if (exists) {
                return prev.filter((t) => !tagSuggestionsEqual(t, tag));
            }

            return [...prev, { ...tag, removable: tag.removable ?? true }];
        });
    };

    const stagingSelect = ({ value: v, label: l }: TagSuggestionItem) => {
        if (v !== null) {
            togglePendingTag({
                label: l,
                value: v,
                removable: true,
            });
        }
    };

    const immediateSelect = ({ value: v, label: l }: TagSuggestionItem) => {
        if (v !== null) {
            onNewTags([
                {
                    label: l,
                    value: v,
                    removable: true,
                },
            ]);
            setShowInput(false);
        }
    };

    useEffect(() => {
        if (isBlur === true) {
            setTimeout(() => {
                if (onBlur) {
                    onBlur();
                }
                setIsBlur(false);
            }, 0);
        }
    }, [isBlur, onBlur]);

    const stagingNewSuggestionAction = (v: TagSuggestionItem) => {
        if (newSuggestion?.enabled) {
            togglePendingTag(v);
        }
    };

    const immediateNewSuggestionAction = (v: TagSuggestionItem) => {
        if (newSuggestion?.enabled) {
            newSuggestion.action(v);
            setShowInput(false);
        }
    };

    useEffect(() => {
        if (!showInput) {
            setValue({ value: '', label: '' });

            return;
        }

        if (isMultiSelect) {
            setPendingTags([]);
        }
    }, [showInput, isMultiSelect]);

    const commitPendingAndClose = () => {
        const pending = pendingTagsRef.current;

        if (pending.length > 0) {
            onNewTags(pending);
        }

        setPendingTags([]);
        setShowInput(false);
        setIsBlur(true);
    };

    const discardPendingAndClose = () => {
        setPendingTags([]);
        setShowInput(false);
        setIsBlur(true);
    };

    const clearStagingOnly = () => {
        setPendingTags([]);
    };

    const blurCloseOnly = () => {
        setShowInput(false);
        setIsBlur(true);
    };

    if (showInput) {
        return (
            <AutoComplete
                autoFocus
                closeOnSelect={!isMultiSelect}
                data={data}
                disabled={disabled}
                newSuggestion={{
                    enabled: newSuggestion?.enabled,
                    label: newSuggestion?.label,
                    action: isMultiSelect ? stagingNewSuggestionAction : immediateNewSuggestionAction,
                }}
                onBlur={isMultiSelect ? discardPendingAndClose : blurCloseOnly}
                onSelect={isMultiSelect ? stagingSelect : immediateSelect}
                pendingSelected={isMultiSelect ? pendingTags : undefined}
                placeholder={addNewlabel}
                selected={selected}
                staging={isMultiSelect}
                stagingFooterActions={
                    isMultiSelect
                        ? {
                              onCancel: discardPendingAndClose,
                              onClearStaging: clearStagingOnly,
                              onConfirm: commitPendingAndClose,
                          }
                        : undefined
                }
                value={value}
                {...rest}
                onKeyDown={(e) => {
                    if (e.key === 'Escape' && !isMultiSelect) {
                        e.preventDefault();
                        e.stopPropagation();
                        blurCloseOnly();

                        return;
                    }
                    onKeyDownFromParent?.(e as unknown as KeyboardEvent);
                }}
            />
        );
    }

    return (
        <Tag
            disabled={disabled}
            value={`+ ${addNewlabel}`}
            label={`+ ${addNewlabel}`}
            selectable
            onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                setShowInput(true);
            }}
            size={size}
        />
    );
};

export default AddTag;
