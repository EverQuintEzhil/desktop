import { useState, useEffect } from 'react';

import { cn } from '@/lib/utils';

import AddTag from './add-tag';
import RenderTags from './render-tags';
import { tagSuggestionValuesEqual } from './tag-suggestion-utils';
import { type TagSuggestionItem, type TagsInputProps } from './tags-input.types';
import './tags-input.scss';

const TagsInput = (props: TagsInputProps) => {
    const {
        addNewlabel = 'Add New Tag',
        data = [],
        disabled,
        newSuggestion,
        value: propValue,
        onChange,
        onRemove: onRemoveProp,
        reverse,
        tagProps,
        isError,
        isMultiSelect = false,
        defaultItemValue,
        onDefaultItemChange,
        showDefaultItemStar,
        defaultItemLoading,
        size = 'regular',
        ...rest
    } = props;

    const [tags, setTags] = useState(Array.isArray(propValue) ? propValue : []);

    useEffect(() => {
        if (Array.isArray(propValue)) {
            setTags(propValue);
        }
    }, [propValue]);

    const onRemove = (index: number) => {
        const removedItem = tags[index];

        if (onChange) {
            onChange(tags.filter((_item, i: number) => index !== i));
        }
        if (onRemoveProp) {
            onRemoveProp(removedItem, index);
        }
        if (
            onDefaultItemChange &&
            typeof defaultItemValue !== 'undefined' &&
            removedItem &&
            (Array.isArray(defaultItemValue)
                ? defaultItemValue.some((val) => tagSuggestionValuesEqual(removedItem.value, val))
                : tagSuggestionValuesEqual(removedItem.value, defaultItemValue))
        ) {
            if (Array.isArray(defaultItemValue)) {
                onDefaultItemChange(removedItem, false);
            } else {
                onDefaultItemChange(undefined, false);
            }
        }
    };

    const addNewTags = (newTags: TagSuggestionItem[]) => {
        if (onChange && newTags.length > 0) {
            if (reverse) {
                onChange([...newTags, ...tags]);
            } else {
                onChange([...tags, ...newTags]);
            }
        }
    };

    const renderAddTag = () => {
        if (disabled) {
            return null;
        }

        return (
            <AddTag
                disabled={disabled}
                data={data as TagSuggestionItem[]}
                isMultiSelect={isMultiSelect}
                selected={tags}
                onNewTags={addNewTags}
                newSuggestion={newSuggestion}
                addNewlabel={addNewlabel}
                size={size}
                {...rest}
            />
        );
    };

    const renderTags = () => {
        const tagsComponent = (
            <RenderTags
                tags={tags}
                removable={!disabled}
                onRemove={onRemove}
                tagProps={tagProps}
                size={size}
                defaultItemValue={defaultItemValue}
                onDefaultItemChange={disabled ? undefined : onDefaultItemChange}
                showDefaultItemStar={showDefaultItemStar}
                defaultItemLoading={defaultItemLoading}
            />
        );

        if (reverse) {
            return <div className="grouped mt-6 w-full">{tagsComponent}</div>;
        }

        return tagsComponent;
    };

    const renderContent = () => {
        if (reverse) {
            return (
                <>
                    {renderAddTag()}
                    {renderTags()}
                </>
            );
        }

        return (
            <>
                {renderTags()}
                {renderAddTag()}
            </>
        );
    };

    return (
        <div className={cn('tags-input', isError && 'has-error')}>
            <div className="tag-group flex w-full flex-wrap gap-2">{renderContent()}</div>
        </div>
    );
};

export default TagsInput;
